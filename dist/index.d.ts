// types/index.d.ts

import { AccountInterface } from "starknet";

declare module "typhoon-sdk" {

    

    export interface CallObject {
        contractAddress: string;
        entrypoint: string;
        calldata: any;
    }

    export interface ComplianceObject{
        depositAmount: string,
        depositDate: string,
        depositTxHash: string,
        from: string,
        commitment: string,
        withdrawAmount: string,
        withdrawDate: string,
        withdrawTxHash: string,
        to: string,
        nullifierHash: string,
        fee: string,
        paymasterFee: string
    }

    export class TyphoonSDK {
        constructor();

        init(secrets: string[], nullifiers: string[], pools: string[]): void;

        get_token_minimal_amount(token_address: string): Promise<BigInt>

        generate_approve_and_deposit_calls(amount: BigInt, token_address: string): Promise<CallObject[]>;

        get_withdraw_calldata(txhash: string, receiver_list: string[]): any[];

        get_typedMessage(): any;

        withdraw_fee_by_token(token_address: string): Promise<number>

        get_compliance_data(secret, nullifier, txhash, pool): Promise<ComplianceObject>

        download_notes(txhash: string): Promise<void>

        // store_notes_onchain(secrets: string[], nullifiers: string[], pools: string[], txhash: string): Promise<BigInt>

        withdraw(txHash: string, receiver_list: string[]): Promise<boolean>;

        withdraw_to_anonymous_account(txHash: string, lastAnonPrivKey: string, splited: boolean, address: string, accountid: string): Promise<boolean>;

        get_valid_anonymous_accounts(genPrivKey: string, address: string, accountid: string): Promise<any[]>;

        is_blacklisted(account_address: string): Promise<boolean>;

        add_to_blacklist(caller_account: AccountInterface, blacklisted_address: string): Promise<void>;

        get_secrets(): string[];

        set_secrets(secrets: string[]): void;

        get_nullifiers(): string[];
    
        set_nullifiers(new_nullifiers: string[]): void;
    
        get_pools(): string[];
    
        set_pools(new_pools: string[]): void;
    }
}
