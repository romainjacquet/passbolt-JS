const openpgp = require('openpgp')
const crypto = require('crypto')

// node-fetch no longer support commonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

class Passbolt {
  /**
     * Client for passbolt access
     * @param serverUrl must be url base of Passbolt: example http://mypassbolt.com/
     */
  constructor (serverUrl = '') {
    this.accessToken = {}
    this.refreshToken = {}
    this.serverUrl = serverUrl
    // GPG armored keys
    this.gpgClientPrivateKey = ''
    this.gpgPublicServerKey = ''
    // meta information read from API
    this.resourcesTypes = {}
  }

  /**
    login to the passbolt server and get JWT access token
    this is a basic challenge encrypting an uuid
    @param userId uuid of the user in passbolt DB
    @param privateKey private key of client, openpgp key object
    */
  async login (userId, privateKey) {
    this.gpgPublicServerKey = await this.getServerGpgPubkey()
    this.gpgClientPrivateKey = privateKey
    const generaredVerifiedToken = crypto.randomUUID()
    const json = {
      version: '1.0.0',
      domain: this.serverUrl,
      verify_token: generaredVerifiedToken,
      verify_token_expiry: ((Date.now() + (2 * 60 * 1000)) / 1000)
    }

    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: JSON.stringify(json) }),
      encryptionKeys: this.gpgPublicServerKey,
      signingKeys: this.gpgClientPrivateKey
    })

    const response = await fetch(this.serverUrl + '/auth/jwt/login.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        challenge: encrypted
      })
    })
    const body = await response.text()
    // console.log(body);

    const obj = JSON.parse(body)
    const serverArmoredMessage = obj.body.challenge
    const message = await openpgp.readMessage({ armoredMessage: serverArmoredMessage })
    const clearPayloadStr = await openpgp.decrypt(
      {
        message,
        verificationKeys: this.gpgPublicServerKey,
        decryptionKeys: this.gpgClientPrivateKey
      })
    const clearPayload = JSON.parse(clearPayloadStr.data)
    // checking server response
    const verifyToken = clearPayload.verify_token
    if (verifyToken !== generaredVerifiedToken) {
      console.error('Token mismatch!')
      return false
    }
    console.log('Login : JWT token retrieved.')
    this.accessToken = clearPayload.access_token
    this.refreshToken = clearPayload.refresh_token
    // read resource type
    await this.getResourcesType()
    return true
  }

  /**
   *
   * @returns {boolean} true if resources are fetch
   */
  async getResourcesType () {
    let url = this.serverUrl + "/resource-types.json"
    const options = {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + this.accessToken }
    }
    try {
        const response = await fetch(url, options)
        if(!response.ok){
            console.log("Error getting resources types")
            return false
        }
        const body = await response.json()
        for(const resourceType of body['body']) {
            this.resourcesTypes[resourceType["slug"]] = resourceType["id"]
        }
        return true
    } catch (error){
        console.log('cannot read resource type' + error)
    }
    return false
  }

  /**
   * Logout
   */
  async logout () {
    const url = this.serverUrl + '/auth/jwt/logout.json'
    const options = {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.accessToken },
      body: JSON.stringify({ refresh_token: this.refreshToken })
    }

    try {
      const response = await fetch(url, options)
      const data = await response.json()
    } catch (error) {
      console.error(error)
    }
    console.log('Logout')
  }

  /**
   * Make a request to get to GPG key of the server
   */
  async getServerGpgPubkey () {
    const verifyUrl = this.serverUrl + '/auth/verify.json'
    const result = await fetch(verifyUrl)
    const body = await result.text()
    if (result.ok) {
      const jsonObj = JSON.parse(body)
      return await openpgp.readKey({ armoredKey: jsonObj.body.keydata })
    } else {
      console.warn('Failed to get server public key.')
      return null
    }
  }

  /**
   * return a list of all the resources
   * use only if small number of resources
   */
  async getResources () {
    const url = this.serverUrl + '/resources.json'
    const options = { method: 'GET', headers: { Authorization: 'Bearer ' + this.accessToken } }

    try {
      const response = await fetch(url, options)
      const resources = await response.json()
      return resources
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * add a resource, different type are possible. See the definition in passbolt doc
   * @param {Object} object containing at the key resource_type, user and password
   */
  async addResource (object) {
    // checking parameters
    if(! object.hasOwnProperty("resourceType")){
        console.log("Invalid parameters: missing resourceType")
    }

    if(! this.resourcesTypes[object['resourceType']] ){
        console.log("Unknow resource type")
        return false
    }
    console.log('add resource of type: ' + object['resourceType'])

    const encryptedPassword = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: object['password'] }),
      encryptionKeys: this.gpgPublicServerKey,
      signingKeys: this.gpgClientPrivateKey
    })

    const url = this.serverUrl + '/resources.json'

    // TODO remove hardcoded resource and query API /resource-types.json
    const body = {
      name: 'password4' + object['username'],
      resource_type_id: this.resourcesTypes[object['resourceType']],
      secrets: [{ data: encryptedPassword }]
    }
    const strBody = JSON.stringify(body)
    const options = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
      body: strBody
    }

    try {
      const response = await fetch(url, options)
      const resources = await response.json()
      if (response.status === 200) {
        console.log('new resources created')
      } else {
        console.log('error http:' + resources.header.code)
        console.log('message' + resources.header.message)
        if (resources.body.name) {
          console.log(resources.body.name._required)
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  /**
     *  Delete a resource
     * @param {string} resourceId id of the resource to remove
     */
  async deleteResource (resourceId) {
    const url = this.serverUrl + '/resources/' + resourceId + '.json'
    const options = {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + this.accessToken
      }
    }
    try {
      const response = await fetch(url, options)
      const resources = await response.json()
      if (response.status === 200) {
        console.log('resource has been deleted')
      } else {
        console.log('error http:' + resources.header.code)
        console.log('message' + resources.header.message)
      }
    } catch (error) {
      console.error(error)
    }
  }
}

exports.Passbolt = Passbolt
