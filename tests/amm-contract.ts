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
  
  const initializer = provider.wallet.publicKey;
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

  before(async ()=> {
    const mintRent = await provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    // const airdrop1 = await provider.connection.requestAirdrop(
    //   liquidityProvider.publicKey,
    //   anchor.web3.LAMPORTS_PER_SOL * 1000000
    // );
    
    // await provider.connection.confirmTransaction(airdrop1);
    const airdrop2 = await provider.connection.requestAirdrop(
      poolInitializer.publicKey,
      anchor.web3.LAMPORTS_PER_SOL * 1000000
    );
    await provider.connection.confirmTransaction(airdrop2);

    tokenXMint = await createMint(
      provider.connection,
      tokensAuthority,
      tokensAuthority.publicKey,
      null,
      6,
    );

    tokenYMint = await createMint(
      provider.connection,
      tokensAuthority,
      tokensAuthority.publicKey,
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
      true,
      TOKEN_2022_PROGRAM_ID
    );

    vaultY = await getAssociatedTokenAddress(
      tokenYMint,
      configPda,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    lpVault = await getAssociatedTokenAddress(
      lpMint,
      configPda,
      true,
      TOKEN_2022_PROGRAM_ID
    );

  })


  describe("Initialize Pool", ()=> {

    it("initialize pool", async ()=>{
      const tx = await program.methods.initialize(30, initializer)
      .accounts({
        initializer: initializer,
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

      const lpVaultAccount = await provider.connection.getAccountInfo(lpVault);
      assert.isNotNull(lpVaultAccount, "LP Vault Account Created");

      const vaultXAccount = await provider.connection.getAccountInfo(vaultX);
      assert.isNotNull(vaultXAccount, "Vault X Account Created");

      const vaultYAccount = await provider.connection.getAccountInfo(vaultY);
      assert.isNotNull(vaultYAccount, "Vault Y Account Created");

     
    })

    // it("provide liquidity", async ()=> {
    //   userTokenAccountX = await createAssociatedTokenAccount(
    //     provider.connection,
    //     liquidityProvider,
    //     tokenXMint.publicKey,
    //     liquidityProvider.publicKey
    //   );

    //   userTokenAccountY = await createAssociatedTokenAccount(
    //     provider.connection,
    //     liquidityProvider,
    //     tokenYMint.publicKey,
    //     liquidityProvider.publicKey
    //   );

    //   userLpTokenAccount = await createAssociatedTokenAccount(
    //     provider.connection,
    //     liquidityProvider,
    //     lpMint,
    //     liquidityProvider.publicKey,
    //   );
      
    //   await mintTo(
    //     provider.connection,
    //     tokensAuthority,
    //     tokenXMint.publicKey,
    //     liquidityProvider.publicKey,
    //     tokensAuthority,
    //     100000 * 1_000_000
    //   );

    //   await mintTo(
    //     provider.connection,
    //     tokensAuthority,
    //     tokenYMint.publicKey,
    //     liquidityProvider.publicKey,
    //     tokensAuthority,
    //     100000 * 1_000_000
    //   );
    // })

    // it("add liquidity", async ()=> {
    //   const quantityX = new anchor.BN(100* 1_000_000);
    //   const quantityY = new anchor.BN(200* 1_000_000);


    //   const tx = await program.methods.deposit(
    //     new anchor.BN(100),
    //     quantityX,
    //     quantityY
    //   )
    //   .accountsPartial({
    //     user: liquidityProvider.publicKey,
    //     mintX: tokenXMint.publicKey,
    //     mintY: tokenYMint.publicKey,
    //     vaultX: vaultX,
    //     vaultY: vaultY,
    //     mintLp: lpMint,
    //     userLp: userLpTokenAccount,
    //   })
    //   .signers([liquidityProvider])
    //   .rpc();

    //   const finalVaultX = await getAccount(provider.connection, vaultX);
    //   const finalVaultY = await getAccount(provider.connection, vaultY);

    //   assert.strictEqual(
    //     finalVaultX.amount.toString(),
    //     quantityX.toString(),
    //     "Vault X amount updated"
    //   );

    //   assert.strictEqual(
    //     finalVaultY.amount.toString(),
    //     quantityY.toString(),
    //     "Vault Y amount updated"
    //   );

    //   const mintInfo = await getMint(provider.connection, lpMint);
    //   assert.isTrue(
    //     Number(mintInfo.supply.toString()) > 0
    //   )
    //   console.log("tokens issued",mintInfo.supply.toString());

    // })

    // it("proportional distribution of liquidity", async()=>{
    //   const quantityX = new anchor.BN(50* 1_000_000);
    //   const quantityY = new anchor.BN(100* 1_000_000);

    //   const initialVaultX = await getAccount(provider.connection, vaultX);
    //   const initialVaultY = await getAccount(provider.connection, vaultY);

    //   const tx = await program.methods.deposit(
    //     new anchor.BN(100),
    //     quantityX,
    //     quantityY
    //   )
    //   .accountsPartial({
    //     user: liquidityProvider.publicKey,
    //     mintX: tokenXMint.publicKey,
    //     mintY: tokenYMint.publicKey,
    //     vaultX: vaultX,
    //     vaultY: vaultY,
    //     mintLp: lpMint,
    //     userLp: userLpTokenAccount,
    //   })
    //   .signers([liquidityProvider])
    //   .rpc();

    //   const finalVaultX = await getAccount(provider.connection, vaultX);
    //   const finalVaultY = await getAccount(provider.connection, vaultY);
      
    //   assert.strictEqual(
    //     (finalVaultX.amount- initialVaultX.amount).toString(),
    //     quantityX.toString(),
    //     "Vault X amount updated"
    //   );

    //   assert.strictEqual(
    //     (finalVaultY.amount- initialVaultY.amount).toString(),
    //     quantityY.toString(),
    //     "Vault Y amount updated"
    //   );
    // })
    // it("should fail with invalid ratio", async()=>{
    //   try {
    //     const quantityX = new anchor.BN(50* 1_000_000);
    //     const quantityY = new anchor.BN(100* 1_000_000);

    //     const tx = await program.methods.deposit(
    //       new anchor.BN(1000000),
    //       quantityX,
    //       quantityY
    //     )
    //     .accountsPartial({
    //       user: liquidityProvider.publicKey,
    //       mintX: tokenXMint.publicKey,
    //       mintY: tokenYMint.publicKey,
    //       vaultX: vaultX,
    //       vaultY: vaultY,
    //       mintLp: lpMint,
    //       userLp: userLpTokenAccount,
    //     })
    //     .signers([liquidityProvider])
    //     .rpc();

    //     assert.fail("should have failed");
    //   }
    //   catch(er){
    //     console.log("error due to invalid ratio",er);
    //   }


    // })
  })
});
