# Passbolt-JS

Passbolt-JS is a minimal javascript library to access to [Passbolt](https://www.passbolt.com/), the password manager for teams. It is intended to be minimal and light. It provides very basic operations:
- login / logout
- create passwords (i.e resources in the passbolt jargon)
- delete passwords

The benefit of using this library is having an abstraction that hide cryptographics operations required to talk with passbolt server. It's not very complicated but it could be difficult for people not familiar with PGP.

## Tutorial

To use the API, you need an account on passbolt. The following information will be required:
  * the PGP private key of the user which is called `recovery kit` in the passbolt terminology. Copy it in the local folder in a file named `privatekey.asc`
  * the passphrase of the user. It will required on the command line

You also need the UUID of the user which required an administrator access to passbolt. Two methods are possible:

  * with the UI, go the users menu, select your profile, and click `share the profile`. The end of  the url is the UUID. Example `https://mypassbolt.com/app/users/view/a6a2fdc2-adac-11ef-84f8-13d1e186a243`
  * connect to the SQL database and run the request on the users table. `select id from users where username='admin@mypassbolt.com';`

### run the example

Run the example in tests folder
```shell
node tests/connection.js --client-private-key ./privatekey.asc --client-passphrase IAmACoolDevelopper --user-uuid a6a2fdc2-adac-11ef-84f8-13d1e186a243 --url https://mypassbolt.com
Login : JWT token retrieved.
Successfull login on https://passbolt.test
found 207 passwords
Logout
End of example
```


## Technical part

It is a suite of passbolt API calls. The login is the only complex part, a classical challenge
 that consist to encrypt and sign an generated UUID.
The library is a ES6 module that encapsulate all the operations in a class. It used two others librairies:
  * [openpgp](https://www.npmjs.com/package/openpgp) for all PGP operations
  * [node-fetch](https://www.npmjs.com/package/node-fetch) to interact with the server

Start by install the dependencies:
```shell
npm install
```

## Limitations

The login requires the UUID of the user. Currently, I didn't find solution to tackle this.
If you browse the passbolt documentation API you will see that only resource and login stuffs are currently implemented.

## Context

I decide to create this library because I didn't find any library to do this in Javascript. With the Python language, there are many librairies like [passbolt-python-api](https://github.com/shubhamdipt/passbolt-python-api) or [daniel_lynch.passbolt](https://github.com/daniel-lynch/daniel_lynch.passbolt) used by the ansible module.
I have used this minimal library to run massive operations on a passbolt using another framework that require use of JS langage. The other parts of this work cannot be disclosed.
