import { RpcProvider, Account, Contract, json, stark, uint256, shortString, CallData, AccountInterface, constants } from 'starknet';
import * as fs from 'fs';
const sdkSierra = JSON.parse(
    fs.readFileSync('../target/dev/typhoon_sdk_SDK.contract_class.json', 'utf8')
);
const sdkCasm = JSON.parse(
    fs.readFileSync('../target/dev/typhoon_sdk_SDK.compiled_contract_class.json', 'utf8')
);

import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

const provider = new RpcProvider({ nodeUrl: "https://starknet-mainnet.public.blastapi.io/rpc/v0_8"});
const accAddress = "0x03f2039a5c1742f8d90985eabaddf691090176511ebe9d3bcd042b1914918e64"
const account = new Account(provider, accAddress, process.env.PRIVATE_KEY);


async function deploy() {
    console.log("before cons")
    const sdkCallData = new CallData(sdkSierra.abi)
    console.log("addr ", accAddress)
    const sdkConstructor = sdkCallData.compile('constructor', {
        _owner: accAddress,
    });
    let sdkResponse = await account.declareAndDeploy({
        contract: sdkSierra,
        casm: sdkCasm,
        constructorCalldata: sdkConstructor
    });
    await provider.waitForTransaction(sdkResponse.deploy.transaction_hash);
    console.log("sdk deployed at ", sdkResponse.deploy.contract_address)

    return sdkResponse.deploy.contract_address;
}

deploy().then((sdk) => {
    // console.log(typhoon)
    const jsonString = JSON.stringify({ "SDK": sdk }, null, 2); // The third argument adds indentation for readability

    // Write the JSON string to a file
    fs.writeFile('sdk-mainnet.json', jsonString, 'utf8', (err) => {
        if (err) {
            console.error('An error occurred while writing JSON Object to File:', err);
        } else {
            console.log('JSON file has been saved.');
        }
    });
})