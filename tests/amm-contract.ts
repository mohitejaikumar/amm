import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AmmContract } from "../target/types/amm_contract";
import {createAccount, createAssociatedTokenAccount, createInitializeMintInstruction, createMint, getAccount, getAssociatedTokenAddress, getMint, MINT_SIZE, mintTo, TOKEN_2022_PROGRAM_ID} from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";

describe("amm-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ammContract as Program<AmmContract>;
  const provider = anchor.getProvider();
  
  const wallet = provider.wallet as anchor.Wallet;
  const poolAuthority = anchor.web3.Keypair.generate();
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
    const airdrop = await provider.connection.requestAirdrop(
      liquidityProvider.publicKey,
      anchor.web3.LAMPORTS_PER_SOL * 1000000
    );
    await provider.connection.confirmTransaction(airdrop);

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
      liquidityProvider,
      tokenXMint,
      liquidityProvider.publicKey
    )

    userTokenAccountY = await createAssociatedTokenAccount(
      provider.connection,
      liquidityProvider,
      tokenYMint,
      liquidityProvider.publicKey
    )
  })


  describe("Initialize Pool", ()=> {

    it("initialize pool", async ()=>{
      const tx = await program.methods.initialize(fees, poolAuthority.publicKey)
      .accounts({
        initializer: wallet.publicKey,
        mintX: tokenXMint,
        mintY: tokenYMint,
      })
      .rpc();

      const pool = await program.account.config.fetch(configPda);

      assert.strictEqual(
        pool.authority.toBase58(),
        poolAuthority.publicKey.toBase58(),
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
    
    it("provide liquidity", async ()=> {

      userLpTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        liquidityProvider,
        lpMint,
        liquidityProvider.publicKey,
      );
      
      await mintTo(
        provider.connection,
        wallet.payer,
        tokenXMint,
        userTokenAccountX,
        wallet.publicKey,
        1_000 * 1_000_000
      );

      await mintTo(
        provider.connection,
        wallet.payer,
        tokenYMint,
        userTokenAccountY,
        wallet.publicKey,
        1_000 * 1_000_000
      );

      const amount = new BN(50_000_000);
      const maxX = new BN(100*1_000_000);
      const maxY = new BN(200*1_000_000);

      const userXBalanceBefore = await provider.connection.getTokenAccountBalance(userTokenAccountX);
      const userYBalanceBefore = await provider.connection.getTokenAccountBalance(userTokenAccountY);
      const vaultXBalanceBefore = await provider.connection.getTokenAccountBalance(vaultX);
      const vaultYBalanceBefore = await provider.connection.getTokenAccountBalance(vaultY);

      await program.methods
        .deposit(
          new anchor.BN(amount),
          maxX,
          maxY
        )
        .accountsPartial({
          user: liquidityProvider.publicKey,
          mintX: tokenXMint,
          mintY: tokenYMint,
          vaultX: vaultX,
          vaultY: vaultY,
          mintLp: lpMint,
          userLp: userLpTokenAccount,
        })
        .signers([liquidityProvider])
        .rpc();

      const userXBalanceAfter = await provider.connection.getTokenAccountBalance(userTokenAccountX);
      const userYBalanceAfter = await provider.connection.getTokenAccountBalance(userTokenAccountY);
      const vaultXBalanceAfter = await provider.connection.getTokenAccountBalance(vaultX);
      const vaultYBalanceAfter = await provider.connection.getTokenAccountBalance(vaultY);
      const userLpBalanceAfter = await provider.connection.getTokenAccountBalance(userLpTokenAccount);

      console.log("X user balance",userXBalanceAfter.value.amount.toString(), userXBalanceBefore.value.amount.toString());
      console.log("Y user balance",userYBalanceAfter.value.amount.toString(), userYBalanceBefore.value.amount.toString());
      console.log("X vault balance",vaultXBalanceAfter.value.amount.toString(), vaultXBalanceBefore.value.amount.toString());
      console.log("Y vault balance",vaultYBalanceAfter.value.amount.toString(), vaultYBalanceBefore.value.amount.toString());
      console.log("LP balance",userLpBalanceAfter.value.amount.toString(),0);
      console.log(userLpBalanceAfter.value.amount.toString());
      
      assert.equal(
        new BN(userXBalanceBefore.value.amount).sub(new BN(userXBalanceAfter.value.amount)).toString(),
        maxX.toString(),
        "X user balance updated"
      );

      assert.equal(
        new BN(userYBalanceBefore.value.amount).sub(new BN(userYBalanceAfter.value.amount)).toString(),
        maxY.toString(),
        "Y user balance updated"
      );

      assert.equal(
        new BN(vaultXBalanceAfter.value.amount).sub(new BN(vaultXBalanceBefore.value.amount)).toString(),
        maxX.toString(),
        "X vault balance updated"
      );

      assert.equal(
        new BN(vaultYBalanceAfter.value.amount).sub(new BN(vaultYBalanceBefore.value.amount)).toString(),
        maxY.toString(),
        "Y vault balance updated"
      );

      assert.equal(
        new BN(userLpBalanceAfter.value.amount).sub(new BN(0)).toString(),
        amount.toString(),
        "LP balance updated"
      );
    })

    it("check proportional distribution of liquidity", async()=>{
      const secont_lp_amount = new BN(10*1_000_000);
      const maxX = new BN(10*1_000_000); // correct amount should be greater than 50*1_000_000
      const maxY = new BN(100*1_000_000);

      const userXBalanceBefore = await provider.connection.getTokenAccountBalance(userTokenAccountX);
      const userYBalanceBefore = await provider.connection.getTokenAccountBalance(userTokenAccountY);
      const vaultXBalanceBefore = await provider.connection.getTokenAccountBalance(vaultX);
      const vaultYBalanceBefore = await provider.connection.getTokenAccountBalance(vaultY);
      const userLpBalanceBefore = await provider.connection.getTokenAccountBalance(userLpTokenAccount);

      try {
        await program.methods
        .deposit(
          secont_lp_amount,
          maxX,
          maxY
        )
        .accountsPartial({
          user: liquidityProvider.publicKey,
          mintX: tokenXMint,
          mintY: tokenYMint,
          vaultX: vaultX,
          vaultY: vaultY,
          mintLp: lpMint,
          userLp: userLpTokenAccount,
        })
        .signers([liquidityProvider])
        .rpc();
        assert.fail("should have failed");
      }
      catch (err){
        console.log("error due to invalid ratio",JSON.stringify(err));
      }

      const userXBalanceAfter = await provider.connection.getTokenAccountBalance(userTokenAccountX);
      const userYBalanceAfter = await provider.connection.getTokenAccountBalance(userTokenAccountY);
      const vaultXBalanceAfter = await provider.connection.getTokenAccountBalance(vaultX);
      const vaultYBalanceAfter = await provider.connection.getTokenAccountBalance(vaultY);
      const userLpBalanceAfter = await provider.connection.getTokenAccountBalance(userLpTokenAccount);

      console.log("X user balance",userXBalanceAfter.value.amount.toString(), userXBalanceBefore.value.amount.toString());
      console.log("Y user balance",userYBalanceAfter.value.amount.toString(), userYBalanceBefore.value.amount.toString());
      console.log("X vault balance",vaultXBalanceAfter.value.amount.toString(), vaultXBalanceBefore.value.amount.toString());
      console.log("Y vault balance",vaultYBalanceAfter.value.amount.toString(), vaultYBalanceBefore.value.amount.toString());
      console.log("LP balance",userLpBalanceAfter.value.amount.toString(), userLpBalanceBefore.value.amount.toString());

      assert.equal(
        new BN(userXBalanceAfter.value.amount).sub(new BN(userXBalanceBefore.value.amount)).toString(),
        "0",
        "X user balance updated"
      );

      assert.equal(
        new BN(userYBalanceAfter.value.amount).sub(new BN(userYBalanceBefore.value.amount)).toString(),
        "0",
        "Y user balance updated"
      );

      assert.equal(
        new BN(vaultXBalanceAfter.value.amount).sub(new BN(vaultXBalanceBefore.value.amount)).toString(),
        "0",
        "X vault balance updated"
      );

      assert.equal(
        new BN(vaultYBalanceAfter.value.amount).sub(new BN(vaultYBalanceBefore.value.amount)).toString(),
        "0",
        "Y vault balance updated"
      );

      assert.equal(
        new BN(userLpBalanceAfter.value.amount).sub(new BN(userLpBalanceBefore.value.amount)).toString(),
        "0",
        "LP balance updated"
      )
    })
  })
});
