const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SecureEscrow", function () {
  let escrow;
  let owner, operator, buyer, seller, attacker;
  const ESCROW_AMOUNT = ethers.parseEther("0.001");
  const DISPUTE_WINDOW = 300; // 5 minutes in seconds

  beforeEach(async function () {
    [owner, operator, buyer, seller, attacker] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("SecureEscrow");
    escrow = await Factory.deploy(operator.address);
    await escrow.waitForDeployment();
  });

  // ─── Deployment ─────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets owner and backendOperator correctly", async function () {
      expect(await escrow.owner()).to.equal(owner.address);
      expect(await escrow.backendOperator()).to.equal(operator.address);
    });
  });

  // ─── createEscrow ────────────────────────────────────────────────────────────
  describe("createEscrow", function () {
    it("creates an escrow record in AWAITING_PAYMENT state", async function () {
      await escrow.connect(operator).createEscrow(
        "ORDER-001", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
      );
      const e = await escrow.getEscrow("ORDER-001");
      expect(e.exists).to.be.true;
      expect(e.state).to.equal(0); // AWAITING_PAYMENT
      expect(e.amount).to.equal(ESCROW_AMOUNT);
    });

    it("emits EscrowCreated event", async function () {
      await expect(
        escrow.connect(operator).createEscrow(
          "ORDER-002", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
        )
      ).to.emit(escrow, "EscrowCreated")
        .withArgs("ORDER-002", buyer.address, seller.address, ESCROW_AMOUNT);
    });

    it("reverts if escrow already exists", async function () {
      await escrow.connect(operator).createEscrow(
        "ORDER-003", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
      );
      await expect(
        escrow.connect(operator).createEscrow(
          "ORDER-003", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
        )
      ).to.be.revertedWith("SecureEscrow: Escrow already exists");
    });

    it("reverts if called by unauthorized account", async function () {
      await expect(
        escrow.connect(attacker).createEscrow(
          "ORDER-004", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
        )
      ).to.be.revertedWith("SecureEscrow: Not authorized");
    });

    it("reverts if buyer equals seller", async function () {
      await expect(
        escrow.connect(operator).createEscrow(
          "ORDER-005", buyer.address, buyer.address, ESCROW_AMOUNT, DISPUTE_WINDOW
        )
      ).to.be.revertedWith("SecureEscrow: Buyer and seller must differ");
    });
  });

  // ─── fundEscrow ──────────────────────────────────────────────────────────────
  describe("fundEscrow", function () {
    beforeEach(async function () {
      await escrow.connect(operator).createEscrow(
        "ORDER-010", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
      );
    });

    it("funds escrow with correct amount and transitions to FUNDED", async function () {
      await escrow.connect(operator).fundEscrow("ORDER-010", { value: ESCROW_AMOUNT });
      const e = await escrow.getEscrow("ORDER-010");
      expect(e.state).to.equal(1); // FUNDED
    });

    it("emits EscrowFunded event", async function () {
      await expect(
        escrow.connect(operator).fundEscrow("ORDER-010", { value: ESCROW_AMOUNT })
      ).to.emit(escrow, "EscrowFunded");
    });

    it("reverts if incorrect amount is sent", async function () {
      await expect(
        escrow.connect(operator).fundEscrow("ORDER-010", { value: ethers.parseEther("0.002") })
      ).to.be.revertedWith("SecureEscrow: Incorrect funding amount");
    });

    it("reverts duplicate funding attempt", async function () {
      await escrow.connect(operator).fundEscrow("ORDER-010", { value: ESCROW_AMOUNT });
      await expect(
        escrow.connect(operator).fundEscrow("ORDER-010", { value: ESCROW_AMOUNT })
      ).to.be.revertedWith("SecureEscrow: Invalid state for this operation");
    });

    it("reverts if called by unauthorized account", async function () {
      await expect(
        escrow.connect(attacker).fundEscrow("ORDER-010", { value: ESCROW_AMOUNT })
      ).to.be.revertedWith("SecureEscrow: Not authorized");
    });
  });

  // ─── confirmDelivery ─────────────────────────────────────────────────────────
  describe("confirmDelivery", function () {
    beforeEach(async function () {
      await escrow.connect(operator).createEscrow(
        "ORDER-020", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
      );
      await escrow.connect(operator).fundEscrow("ORDER-020", { value: ESCROW_AMOUNT });
    });

    it("transitions to DELIVERY_CONFIRMED and emits event", async function () {
      await expect(
        escrow.connect(operator).confirmDelivery("ORDER-020")
      ).to.emit(escrow, "DeliveryConfirmed");
      const e = await escrow.getEscrow("ORDER-020");
      expect(e.state).to.equal(2); // DELIVERY_CONFIRMED
    });

    it("reverts if not in FUNDED state", async function () {
      await escrow.connect(operator).confirmDelivery("ORDER-020");
      await expect(
        escrow.connect(operator).confirmDelivery("ORDER-020")
      ).to.be.revertedWith("SecureEscrow: Invalid state for this operation");
    });
  });

  // ─── raiseDispute ────────────────────────────────────────────────────────────
  describe("raiseDispute", function () {
    beforeEach(async function () {
      await escrow.connect(operator).createEscrow(
        "ORDER-030", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
      );
      await escrow.connect(operator).fundEscrow("ORDER-030", { value: ESCROW_AMOUNT });
      await escrow.connect(operator).confirmDelivery("ORDER-030");
    });

    it("transitions to DISPUTED within window and emits event", async function () {
      await expect(
        escrow.connect(operator).raiseDispute("ORDER-030")
      ).to.emit(escrow, "DisputeRaised");
      const e = await escrow.getEscrow("ORDER-030");
      expect(e.state).to.equal(3); // DISPUTED
    });

    it("reverts if dispute window has closed", async function () {
      await time.increase(DISPUTE_WINDOW + 1);
      await expect(
        escrow.connect(operator).raiseDispute("ORDER-030")
      ).to.be.revertedWith("SecureEscrow: Dispute window has closed");
    });
  });

  // ─── releaseFunds ────────────────────────────────────────────────────────────
  describe("releaseFunds", function () {
    beforeEach(async function () {
      await escrow.connect(operator).createEscrow(
        "ORDER-040", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
      );
      await escrow.connect(operator).fundEscrow("ORDER-040", { value: ESCROW_AMOUNT });
      await escrow.connect(operator).confirmDelivery("ORDER-040");
    });

    it("releases funds to seller after dispute window → RELEASED", async function () {
      await time.increase(DISPUTE_WINDOW + 1);
      const sellerBefore = await ethers.provider.getBalance(seller.address);
      await escrow.connect(operator).releaseFunds("ORDER-040");
      const sellerAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerAfter - sellerBefore).to.equal(ESCROW_AMOUNT);
      const e = await escrow.getEscrow("ORDER-040");
      expect(e.state).to.equal(4); // RELEASED
    });

    it("blocks settlement during active dispute window", async function () {
      await expect(
        escrow.connect(operator).releaseFunds("ORDER-040")
      ).to.be.revertedWith("SecureEscrow: Dispute window still active");
    });

    it("prevents duplicate settlement", async function () {
      await time.increase(DISPUTE_WINDOW + 1);
      await escrow.connect(operator).releaseFunds("ORDER-040");
      await expect(
        escrow.connect(operator).releaseFunds("ORDER-040")
      ).to.be.revertedWith("SecureEscrow: Invalid state for this operation");
    });

    it("blocks release when order is in DISPUTED state", async function () {
      await escrow.connect(operator).raiseDispute("ORDER-040");
      await time.increase(DISPUTE_WINDOW + 1);
      await expect(
        escrow.connect(operator).releaseFunds("ORDER-040")
      ).to.be.revertedWith("SecureEscrow: Invalid state for this operation");
    });
  });

  // ─── Admin functions ─────────────────────────────────────────────────────────
  describe("adminRelease / adminRefund", function () {
    beforeEach(async function () {
      await escrow.connect(operator).createEscrow(
        "ORDER-050", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
      );
      await escrow.connect(operator).fundEscrow("ORDER-050", { value: ESCROW_AMOUNT });
      await escrow.connect(operator).confirmDelivery("ORDER-050");
      await escrow.connect(operator).raiseDispute("ORDER-050");
    });

    it("adminRelease sends funds to seller → RELEASED", async function () {
      const sellerBefore = await ethers.provider.getBalance(seller.address);
      await escrow.connect(owner).adminRelease("ORDER-050");
      const sellerAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerAfter - sellerBefore).to.equal(ESCROW_AMOUNT);
      const e = await escrow.getEscrow("ORDER-050");
      expect(e.state).to.equal(4); // RELEASED
    });

    it("adminRefund sends funds to buyer → REFUNDED", async function () {
      const buyerBefore = await ethers.provider.getBalance(buyer.address);
      await escrow.connect(owner).adminRefund("ORDER-050");
      const buyerAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerAfter - buyerBefore).to.equal(ESCROW_AMOUNT);
      const e = await escrow.getEscrow("ORDER-050");
      expect(e.state).to.equal(5); // REFUNDED
    });

    it("reverts adminRelease from unauthorized account", async function () {
      await expect(
        escrow.connect(attacker).adminRelease("ORDER-050")
      ).to.be.revertedWith("SecureEscrow: Not authorized");
    });

    it("reverts adminRefund from unauthorized account", async function () {
      await expect(
        escrow.connect(attacker).adminRefund("ORDER-050")
      ).to.be.revertedWith("SecureEscrow: Not authorized");
    });
  });

  // ─── View helpers ────────────────────────────────────────────────────────────
  describe("View helpers", function () {
    it("canRelease returns false during dispute window", async function () {
      await escrow.connect(operator).createEscrow(
        "ORDER-060", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
      );
      await escrow.connect(operator).fundEscrow("ORDER-060", { value: ESCROW_AMOUNT });
      await escrow.connect(operator).confirmDelivery("ORDER-060");
      expect(await escrow.canRelease("ORDER-060")).to.be.false;
    });

    it("canRelease returns true after dispute window", async function () {
      await escrow.connect(operator).createEscrow(
        "ORDER-061", buyer.address, seller.address, ESCROW_AMOUNT, DISPUTE_WINDOW
      );
      await escrow.connect(operator).fundEscrow("ORDER-061", { value: ESCROW_AMOUNT });
      await escrow.connect(operator).confirmDelivery("ORDER-061");
      await time.increase(DISPUTE_WINDOW + 1);
      expect(await escrow.canRelease("ORDER-061")).to.be.true;
    });

    it("getEscrowState reverts for non-existent escrow", async function () {
      await expect(
        escrow.getEscrowState("NONEXISTENT")
      ).to.be.revertedWith("SecureEscrow: Escrow does not exist");
    });
  });
});
