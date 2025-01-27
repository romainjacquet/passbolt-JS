

const commander = require('commander');
const passbolt = require('../src/passbolt');

/********************************************************************** */
async function main(){
    // parse CLI
    const program = new commander.Command()
    program
    .description(`testing prog for passbolt.`)
    .usage('CLI help')
    .addOption(new commander.Option('--client-private-key <client_private_key>', 'path to the private client key. ').makeOptionMandatory())
    .addOption(new commander.Option('--client-passphrase <client_passphrase>', 'passphrase that protect the key').makeOptionMandatory())
    .addOption(new commander.Option('--user-uuid <user_uuid>', 'user uuid').makeOptionMandatory())
    .addOption(new commander.Option('--url <url>', 'passbolt url').makeOptionMandatory())
    .parse(process.argv)
    let program_options = program.opts()

    // connect to passbolt
    let client = new passbolt.Passbolt(program_options.url);
    if(! await client.login(
        program_options.userUuid,
        program_options.clientPrivateKey,
        program_options.clientPassphrase
    )){
            console.error( `Failed to login to ${program_options.url}`)
    } else {
        console.log("Successfull login on " + program_options.url)
    }
    const resources = await client.getResources()
    console.log(`found ${resources['body'].length} passwords`)
    await client.logout()
    console.log("End of example")
}

/********************************************************************** */
main()
