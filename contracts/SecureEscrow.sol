// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SecureEscrow
 * @notice Internal blockchain escrow for ShopSafe e-commerce platform.
 *         Customers never interact with this contract directly.
 *         The backend service manages all interactions using designated accounts.
 */
contract SecureEscrow {
    // ─── Roles ────────────────────────────────────────────────────────────────
    address public immutable owner;       // Contract deployer / platform admin
    address public immutable backendOperator; // Backend service account

    // ─── Escrow States ────────────────────────────────────────────────────────
    enum EscrowState {
        AWAITING_PAYMENT,    // 0 – Escrow created, waiting for funding
        FUNDED,              // 1 – Payment received and held in escrow
        DELIVERY_CONFIRMED,  // 2 – Delivery verified, dispute window open
        DISPUTED,            // 3 – Customer raised a dispute
        RELEASED,            // 4 – Funds released to seller
        REFUNDED             // 5 – Funds refunded to buyer
    }

    // ─── Escrow Record ────────────────────────────────────────────────────────
    struct Escrow {
        string  orderId;
        address buyer;
        address seller;
        uint256 amount;
        EscrowState state;
        uint256 fundedAt;
        uint256 deliveryConfirmedAt;
        uint256 disputeWindowSeconds; // configurable per-escrow
        bool    exists;
    }

    // orderId → Escrow
    mapping(string => Escrow) private escrows;

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant DEFAULT_DISPUTE_WINDOW = 5 minutes; // short for demo

    // ─── Events ───────────────────────────────────────────────────────────────
    event EscrowCreated(string indexed orderId, address buyer, address seller, uint256 amount);
    event EscrowFunded(string indexed orderId, uint256 amount, uint256 fundedAt);
    event DeliveryConfirmed(string indexed orderId, uint256 confirmedAt, uint256 disputeWindowEnds);
    event DisputeRaised(string indexed orderId, uint256 raisedAt);
    event FundsReleased(string indexed orderId, address recipient, uint256 amount);
    event FundsRefunded(string indexed orderId, address recipient, uint256 amount);

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwnerOrOperator() {
        require(
            msg.sender == owner || msg.sender == backendOperator,
            "SecureEscrow: Not authorized"
        );
        _;
    }

    modifier escrowExists(string calldata orderId) {
        require(escrows[orderId].exists, "SecureEscrow: Escrow does not exist");
        _;
    }

    modifier inState(string calldata orderId, EscrowState expected) {
        require(
            escrows[orderId].state == expected,
            "SecureEscrow: Invalid state for this operation"
        );
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _backendOperator) {
        require(_backendOperator != address(0), "SecureEscrow: Invalid operator");
        owner = msg.sender;
        backendOperator = _backendOperator;
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /**
     * @notice Create a new escrow record for an order.
     * @dev Called by backend when a customer places an order.
     *      No funds are transferred at this point.
     */
    function createEscrow(
        string calldata orderId,
        address buyer,
        address seller,
        uint256 amount,
        uint256 disputeWindowSeconds
    ) external onlyOwnerOrOperator {
        require(!escrows[orderId].exists, "SecureEscrow: Escrow already exists");
        require(buyer != address(0) && seller != address(0), "SecureEscrow: Invalid addresses");
        require(amount > 0, "SecureEscrow: Amount must be > 0");
        require(buyer != seller, "SecureEscrow: Buyer and seller must differ");

        uint256 window = disputeWindowSeconds > 0 ? disputeWindowSeconds : DEFAULT_DISPUTE_WINDOW;

        escrows[orderId] = Escrow({
            orderId: orderId,
            buyer: buyer,
            seller: seller,
            amount: amount,
            state: EscrowState.AWAITING_PAYMENT,
            fundedAt: 0,
            deliveryConfirmedAt: 0,
            disputeWindowSeconds: window,
            exists: true
        });

        emit EscrowCreated(orderId, buyer, seller, amount);
    }

    /**
     * @notice Fund the escrow with ETH.
     * @dev Backend calls this with exact ETH. Only one funding per escrow.
     */
    function fundEscrow(string calldata orderId)
        external
        payable
        onlyOwnerOrOperator
        escrowExists(orderId)
        inState(orderId, EscrowState.AWAITING_PAYMENT)
    {
        Escrow storage e = escrows[orderId];
        require(msg.value == e.amount, "SecureEscrow: Incorrect funding amount");

        e.state = EscrowState.FUNDED;
        e.fundedAt = block.timestamp;

        emit EscrowFunded(orderId, msg.value, block.timestamp);
    }

    /**
     * @notice Confirm delivery after OTP verification on backend.
     *         Starts the dispute window timer.
     */
    function confirmDelivery(string calldata orderId)
        external
        onlyOwnerOrOperator
        escrowExists(orderId)
        inState(orderId, EscrowState.FUNDED)
    {
        Escrow storage e = escrows[orderId];
        e.state = EscrowState.DELIVERY_CONFIRMED;
        e.deliveryConfirmedAt = block.timestamp;

        emit DeliveryConfirmed(
            orderId,
            block.timestamp,
            block.timestamp + e.disputeWindowSeconds
        );
    }

    /**
     * @notice Customer raises a dispute within the dispute window.
     * @dev Backend validates eligibility before calling.
     */
    function raiseDispute(string calldata orderId)
        external
        onlyOwnerOrOperator
        escrowExists(orderId)
        inState(orderId, EscrowState.DELIVERY_CONFIRMED)
    {
        Escrow storage e = escrows[orderId];
        require(
            block.timestamp <= e.deliveryConfirmedAt + e.disputeWindowSeconds,
            "SecureEscrow: Dispute window has closed"
        );

        e.state = EscrowState.DISPUTED;
        emit DisputeRaised(orderId, block.timestamp);
    }

    /**
     * @notice Release funds to the seller after dispute window passes.
     * @dev Backend checks on-chain state before calling.
     */
    function releaseFunds(string calldata orderId)
        external
        onlyOwnerOrOperator
        escrowExists(orderId)
        inState(orderId, EscrowState.DELIVERY_CONFIRMED)
    {
        Escrow storage e = escrows[orderId];
        require(
            block.timestamp > e.deliveryConfirmedAt + e.disputeWindowSeconds,
            "SecureEscrow: Dispute window still active"
        );

        e.state = EscrowState.RELEASED;
        uint256 amount = e.amount;
        address seller = e.seller;

        (bool ok, ) = seller.call{value: amount}("");
        require(ok, "SecureEscrow: Transfer to seller failed");

        emit FundsReleased(orderId, seller, amount);
    }

    /**
     * @notice Admin resolves a dispute by releasing to seller.
     */
    function adminRelease(string calldata orderId)
        external
        onlyOwnerOrOperator
        escrowExists(orderId)
        inState(orderId, EscrowState.DISPUTED)
    {
        Escrow storage e = escrows[orderId];
        e.state = EscrowState.RELEASED;
        uint256 amount = e.amount;
        address seller = e.seller;

        (bool ok, ) = seller.call{value: amount}("");
        require(ok, "SecureEscrow: Transfer to seller failed");

        emit FundsReleased(orderId, seller, amount);
    }

    /**
     * @notice Admin resolves a dispute by refunding the buyer.
     */
    function adminRefund(string calldata orderId)
        external
        onlyOwnerOrOperator
        escrowExists(orderId)
        inState(orderId, EscrowState.DISPUTED)
    {
        Escrow storage e = escrows[orderId];
        e.state = EscrowState.REFUNDED;
        uint256 amount = e.amount;
        address buyer = e.buyer;

        (bool ok, ) = buyer.call{value: amount}("");
        require(ok, "SecureEscrow: Transfer to buyer failed");

        emit FundsRefunded(orderId, buyer, amount);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getEscrow(string calldata orderId)
        external
        view
        returns (
            address buyer,
            address seller,
            uint256 amount,
            EscrowState state,
            uint256 fundedAt,
            uint256 deliveryConfirmedAt,
            uint256 disputeWindowSeconds,
            bool exists
        )
    {
        Escrow storage e = escrows[orderId];
        return (
            e.buyer,
            e.seller,
            e.amount,
            e.state,
            e.fundedAt,
            e.deliveryConfirmedAt,
            e.disputeWindowSeconds,
            e.exists
        );
    }

    function getEscrowState(string calldata orderId)
        external
        view
        escrowExists(orderId)
        returns (EscrowState)
    {
        return escrows[orderId].state;
    }

    function isDisputeWindowOpen(string calldata orderId)
        external
        view
        escrowExists(orderId)
        returns (bool)
    {
        Escrow storage e = escrows[orderId];
        if (e.state != EscrowState.DELIVERY_CONFIRMED) return false;
        return block.timestamp <= e.deliveryConfirmedAt + e.disputeWindowSeconds;
    }

    function canRelease(string calldata orderId)
        external
        view
        escrowExists(orderId)
        returns (bool)
    {
        Escrow storage e = escrows[orderId];
        if (e.state != EscrowState.DELIVERY_CONFIRMED) return false;
        return block.timestamp > e.deliveryConfirmedAt + e.disputeWindowSeconds;
    }

    // Receive ETH
    receive() external payable {}
}
