import { Request, Response, NextFunction } from "express";
import StellarSdk from "@stellar/stellar-sdk";
import { transactionStore } from "../workers/transactionStore";
import { AppError } from "../errors/AppError";

interface FeeBumpRequest {
  xdr: string;
  submit?: boolean;
  token?: string;
}

interface FeeBumpResponse {
  xdr: string;
  status: string;
  hash?: string;
  fee_payer: string;
}

export function feeBumpHandler(
  req: Request,
  res: Response,
  next: NextFunction,
  config: Config
): void {
  try {
    const result = FeeBumpSchema.safeParse(req.body);

    if (!result.success) {
      console.warn(
        "Validation failed for fee-bump request:",
        result.error.format()
      );
      return next(
        new AppError(
          `Validation failed: ${JSON.stringify(result.error.format())}`,
          400,
          "INVALID_XDR"
        )
      );
      
      const body: FeeBumpRequest = req.body;
      if (!body.xdr) {
        res.status(400).json({ error: "Missing 'xdr' field in request body" });
        return;
      }
    }

    // Pick a fee payer account using Round Robin
    const feePayerAccount = pickFeePayerAccount(config);
    console.log(`Received fee-bump request | fee_payer: ${feePayerAccount.publicKey}`);

    let innerTransaction: any;
    try {
      innerTransaction = StellarSdk.TransactionBuilder.fromXDR(
        body.xdr,
        config.networkPassphrase,
      );
    } catch (error: any) {
      console.error("Failed to parse XDR:", error.message);
      return next(
        new AppError(`Invalid XDR: ${error.message}`, 400, "INVALID_XDR")
      );
    }

    if (innerTransaction.signatures.length === 0) {
      return next(
        new AppError(
          "Inner transaction must be signed before fee-bumping",
          400,
          "UNSIGNED_TRANSACTION"
        )
      );
    }

    if ("feeBumpTransaction" in innerTransaction) {
      return next(
        new AppError(
          "Cannot fee-bump an already fee-bumped transaction",
          400,
          "ALREADY_FEE_BUMPED"
        )
      );
    }

    const feeAmount = Math.floor(config.baseFee * config.feeMultiplier);

    const feePayerKeypair = StellarSdk.Keypair.fromSecret(
      config.feePayerSecret,
    );

    const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      feePayerAccount.keypair,
      feeAmount,
      innerTransaction,
      config.networkPassphrase,
    );
    feeBumpTx.sign(feePayerAccount.keypair);

    const feeBumpXdr = feeBumpTx.toXDR();
    console.log(`Fee-bump transaction created | fee_payer: ${feePayerAccount.publicKey}`);

    const submit = body.submit || false;
    const status = submit ? "submitted" : "ready";

    if (submit && config.horizonUrl) {
      const server = new StellarSdk.Horizon.Server(config.horizonUrl);
      server
        .submitTransaction(feeBumpTx)
        .then((result: any) => {
          // Track the submitted transaction
          transactionStore.addTransaction(result.hash, "submitted");

          const response: FeeBumpResponse = {
            xdr: feeBumpXdr,
            status: "submitted",
            hash: result.hash,
            fee_payer: feePayerAccount.publicKey,
          };
          res.json(response);
        })
        .catch((error: any) => {
          console.error("Transaction submission failed:", error);
          next(
            new AppError(
              `Transaction submission failed: ${error.message}`,
              500,
              "SUBMISSION_FAILED"
            )
          );
        });
    } else {
      const response: FeeBumpResponse = {
        xdr: feeBumpXdr,
        status,
        fee_payer: feePayerAccount.publicKey,
      };
      res.json(response);
    }
  } catch (error: any) {
    console.error("Error processing fee-bump request:", error);
    next(error);
  }
}