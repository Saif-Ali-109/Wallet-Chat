import { expect } from "chai";
import { ethers } from "hardhat";
import { ChatRegistry } from "../typechain-types";

describe("ChatRegistry", function () {
  let chatRegistry: ChatRegistry;
  let owner: any;
  let otherAccount: any;

  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();
    const ChatRegistry = await ethers.getContractFactory("ChatRegistry");
    chatRegistry = await ChatRegistry.deploy();
  });

  it("Should register an identity", async function () {
    const pubKey = ethers.toUtf8Bytes("test-public-key");
    await chatRegistry.registerIdentity(pubKey);
    expect(await chatRegistry.getEncryptionKey(owner.address)).to.equal(ethers.hexlify(pubKey));
  });

  it("Should emit MessageSent and transfer tip", async function () {
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes("hello world"));
    const tipAmount = ethers.parseEther("0.1");

    const initialBalance = await ethers.provider.getBalance(otherAccount.address);

    await expect(chatRegistry.sendMessage(otherAccount.address, messageHash, { value: tipAmount }))
      .to.emit(chatRegistry, "MessageSent")
      .withArgs(owner.address, otherAccount.address, messageHash, tipAmount, anyUint);

    const finalBalance = await ethers.provider.getBalance(otherAccount.address);
    expect(finalBalance - initialBalance).to.equal(tipAmount);
  });
});

const anyUint = (val: any) => typeof val === "bigint" || typeof val === "number";
