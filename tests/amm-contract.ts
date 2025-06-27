import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AmmContract } from "../target/types/amm_contract";
import {createAccount, createAssociatedTokenAccount, createInitializeMintInstruction, createMint, getAccount, getAssociatedTokenAddress, getMint, MINT_SIZE, mintTo, TOKEN_2022_PROGRAM_ID} from "@solana/spl-token";
import { assert } from "chai";

describe("amm-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ammContract as Program<AmmContract>;
  const provider = anchor.getProvider();
  
  const wallet = provider.wallet as anchor.Wallet;
  const tokensAuthority = anchor.web3.Keypair.generate();
  const liquidityProvider = anchor.web3.Keypair.generate();
  const poolInitializer = anchor.web3.Keypair.generate();


  let configPda: anchor.web3.PublicKey;
  let configBump: number;
  let vaultX: anchor.web3.PublicKey;
  let vaultY: anchor.web3.PublicKey;
  let lpMint: anchor.web3.PublicKey;
  let lpVault: anchor.web3.PublicKey;
  let lpBump: number;
  let tokenXMint: anchor.web3.PublicKey;
  let tokenYMint: anchor.web3.PublicKey;
  let userLpTokenAccount: anchor.web3.PublicKey;
  let userTokenAccountX: anchor.web3.PublicKey;
  let userTokenAccountY: anchor.web3.PublicKey;
  
  const fees = 30;

  before(async ()=> {

    tokenXMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
    );

    tokenYMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
    );

    [configPda, configBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config"),
        tokenXMint.toBytes(),
        tokenYMint.toBytes(),
      ],
      program.programId
    );
    
    [lpMint, lpBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lp"),
        configPda.toBytes()
      ],
      program.programId
    );

    vaultX = await getAssociatedTokenAddress(
      tokenXMint,
      configPda,
      true
    );

    vaultY = await getAssociatedTokenAddress(
      tokenYMint,
      configPda,
      true
    );

    userTokenAccountX = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      tokenXMint,
      wallet.publicKey,
    )

    userTokenAccountY = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      tokenYMint,
      wallet.publicKey,
    )
  })


  describe("Initialize Pool", ()=> {

    it("initialize pool", async ()=>{
      const tx = await program.methods.initialize(fees, tokensAuthority.publicKey)
      .accounts({
        initializer: wallet.publicKey,
        mintX: tokenXMint,
        mintY: tokenYMint,
      })
      .rpc();

      const pool = await program.account.config.fetch(configPda);

      assert.strictEqual(
        pool.authority.toBase58(),
        tokensAuthority.publicKey.toBase58(),
        "Pool authority Matched"
      );

      assert.strictEqual(
        pool.mintX.toBase58(),
        tokenXMint.toBase58(),
        "Mint X Matched"
      );

      assert.strictEqual(
        pool.mintY.toBase58(),
        tokenYMint.toBase58(),
        "Mint Y Matched"
      );

      assert.strictEqual(
        pool.fees,
        30,
        "Fees Matched"
      );

      assert.strictEqual(
        pool.myBump,
        configBump,
        "Config Bump Matched"
      );

      assert.strictEqual(
        pool.lpBump,
        lpBump,
        "LP Bump Matched"
      );

      const lpMintAccount = await provider.connection.getAccountInfo(lpMint);
      assert.isNotNull(lpMintAccount, "LP Mint Account Created");

      const vaultXAccount = await provider.connection.getAccountInfo(vaultX);
      assert.isNotNull(vaultXAccount, "Vault X Account Created");

      const vaultYAccount = await provider.connection.getAccountInfo(vaultY);
      assert.isNotNull(vaultYAccount, "Vault Y Account Created");

     
    })

    
  })
});
