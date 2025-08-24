// types/index.d.ts

import { AccountInterface } from "starknet";

declare module "typhoon-sdk" {
    export interface DepositOptions {
        token: string;
        amount: bigint;
        recipient: string;
    }

    export interface WithdrawOptions {
        txHash: string;
        recipient: string;
    }

    export interface CallObject {
        contractAddress: string;
        entrypoint: string;
        calldata: any;
    }

    export class TyphoonSDK {
        constructor();

        init(secrets: string[], nullifiers: string[], pools: string[]): void;

        generate_approve_and_deposit_calls(amount: BigInt, token_address: string): Promise<CallObject[]>;

        withdraw(txHash: string, receiver_list: string[]): Promise<boolean>;

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
