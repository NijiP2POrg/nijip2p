
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";




































contract NijiDeal is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    
    enum Status {
        NONE,
        TAKEN,    
        LOCKED,   
        PAID,     
        SETTLED,  
        REFUNDED, 
        VOIDED,   
        DISPUTED  
    }

    struct Offer {
        uint256 id;
        address seller;
        address token;      
        uint256 maxAmount;  
        uint256 rate;       
        uint64  payWindow;  
        bool    cash;       
        bool    cancelled;
        uint256 activeTradeId;
    }

    struct Trade {
        uint256 id;
        uint256 offerId;
        address seller;
        address buyer;
        address token;
        uint256 amount;      
        uint256 rate;
        Status  status;
        uint64  lockedAt;
        uint64  paidAt;
        address arbiterPin;  
    }

    
    address public immutable USDC;
    address public immutable USDT;
    address public arbiter; 

    uint256 public constant MIN_PAY_WINDOW = 20 minutes; 
    uint256 public constant MAX_PAY_WINDOW = 7 days;     

    uint256 public offerCounter;
    uint256 public tradeCounter;
    mapping(uint256 => Offer) public offers;
    mapping(uint256 => Trade) public trades;

    
    event OfferCreated(uint256 indexed id, address indexed seller, address indexed token, uint256 maxAmount, uint256 rate, uint64 payWindow, bool cash);
    event OfferCancelled(uint256 indexed id);
    event OfferTaken(uint256 indexed offerId, uint256 indexed tradeId, address indexed buyer);
    event TradeVoided(uint256 indexed tradeId, address indexed by);
    event FundsLocked(uint256 indexed tradeId, address indexed seller, uint256 amount);
    event PaymentMarked(uint256 indexed tradeId);
    event TradeSettled(uint256 indexed tradeId, address indexed buyer, uint256 amount);
    event TradeRefunded(uint256 indexed tradeId, address indexed seller);
    event DisputeRaised(uint256 indexed tradeId, address indexed by, string reason);
    event DisputeResolved(uint256 indexed tradeId, bool buyerWins, address indexed resolver);
    event ArbiterSet(address indexed arbiter);

    
    modifier onlyStable(address token) {
        require(token == USDC || token == USDT, "BAD_TOKEN");
        _;
    }

    constructor(address usdc_, address usdt_) Ownable(msg.sender) {
        USDC = usdc_;
        USDT = usdt_;
    }

    function setArbiter(address arbiter_) external onlyOwner {
        require(arbiter_ != address(0), "ZERO_ARBITER");
        arbiter = arbiter_;
        emit ArbiterSet(arbiter_);
    }

    
    
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    
    
    
    
    
    
    
    
    function postOffer(address token, uint256 maxAmount, uint256 rate, uint64 payWindow, bool cash)
        external
        whenNotPaused
        onlyStable(token)
        returns (uint256 id)
    {
        require(maxAmount > 0 && rate > 0, "BAD_INPUT");
        if (cash) {
            
            
            
            
            
            require(payWindow == MAX_PAY_WINDOW, "CASH_WINDOW_7D");
        } else {
            require(payWindow >= MIN_PAY_WINDOW && payWindow <= MAX_PAY_WINDOW, "BAD_WINDOW");
        }
        id = ++offerCounter;
        offers[id] = Offer({
            id: id,
            seller: msg.sender,
            token: token,
            maxAmount: maxAmount,
            rate: rate,
            payWindow: payWindow,
            cash: cash,
            cancelled: false,
            activeTradeId: 0
        });
        emit OfferCreated(id, msg.sender, token, maxAmount, rate, payWindow, cash);
    }

    
    
    function cancelOffer(uint256 offerId) external {
        Offer storage o = offers[offerId];
        require(o.seller == msg.sender, "NOT_SELLER");
        require(!o.cancelled && o.activeTradeId == 0, "NOT_CANCELLABLE");
        o.cancelled = true;
        emit OfferCancelled(offerId);
    }

    
    
    
    
    function takeOffer(uint256 offerId) external returns (uint256 tradeId) {
        Offer storage o = offers[offerId];
        require(!o.cancelled && o.activeTradeId == 0, "OFFER_UNAVAILABLE");
        require(msg.sender != o.seller, "SELF_TAKE");
        tradeId = ++tradeCounter;
        o.activeTradeId = tradeId;
        trades[tradeId] = Trade({
            id: tradeId,
            offerId: offerId,
            seller: o.seller,
            buyer: msg.sender,
            token: o.token,
            amount: 0,
            rate: o.rate,
            status: Status.TAKEN,
            lockedAt: 0,
            paidAt: 0,
            arbiterPin: address(0)
        });
        emit OfferTaken(offerId, tradeId, msg.sender);
    }

    
    
    
    
    function voidTake(uint256 tradeId) external {
        Trade storage t = trades[tradeId];
        require(t.status == Status.TAKEN, "BAD_STATUS");
        require(msg.sender == t.buyer || msg.sender == t.seller, "NOT_PARTY");
        t.status = Status.VOIDED;
        offers[t.offerId].activeTradeId = 0; 
        emit TradeVoided(tradeId, msg.sender);
    }

    
    
    
    
    
    function lockFunds(uint256 tradeId, uint256 amount) external nonReentrant whenNotPaused {
        Trade storage t = trades[tradeId];
        require(t.status == Status.TAKEN, "BAD_STATUS");
        require(msg.sender == t.seller, "NOT_SELLER");
        require(amount > 0 && amount <= offers[t.offerId].maxAmount, "BAD_AMOUNT");

        uint256 balBefore = IERC20(t.token).balanceOf(address(this));
        IERC20(t.token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(t.token).balanceOf(address(this)) - balBefore;
        require(received > 0, "TRANSFER_MISMATCH");

        t.amount = received; 
        t.lockedAt = uint64(block.timestamp);
        t.status = Status.LOCKED;
        emit FundsLocked(tradeId, msg.sender, received);
    }

    
    
    
    function markPaid(uint256 tradeId) external {
        Trade storage t = trades[tradeId];
        require(t.status == Status.LOCKED, "BAD_STATUS");
        require(msg.sender == t.buyer, "NOT_BUYER");
        require(block.timestamp <= uint256(t.lockedAt) + offers[t.offerId].payWindow, "PAY_WINDOW_OVER");
        t.status = Status.PAID;
        t.paidAt = uint64(block.timestamp);
        emit PaymentMarked(tradeId);
    }

    
    
    function confirmRelease(uint256 tradeId) external nonReentrant whenNotPaused {
        Trade storage t = trades[tradeId];
        require(t.status == Status.PAID, "BAD_STATUS");
        require(msg.sender == t.seller, "NOT_SELLER");
        _settle(t);
    }

    
    
    
    function refundExpired(uint256 tradeId) external nonReentrant whenNotPaused {
        Trade storage t = trades[tradeId];
        require(t.status == Status.LOCKED, "BAD_STATUS");
        require(block.timestamp > uint256(t.lockedAt) + offers[t.offerId].payWindow, "NOT_EXPIRED");
        t.status = Status.REFUNDED;
        _consumeOffer(t.offerId);
        IERC20(t.token).safeTransfer(t.seller, t.amount);
        emit TradeRefunded(tradeId, t.seller);
    }

    
    
    
    
    function dispute(uint256 tradeId, string calldata reason) external {
        Trade storage t = trades[tradeId];
        require(t.status == Status.LOCKED || t.status == Status.PAID, "BAD_STATUS");
        require(msg.sender == t.buyer || msg.sender == t.seller, "NOT_PARTY");
        require(arbiter != address(0), "NO_ARBITER");
        t.arbiterPin = arbiter; 
        t.status = Status.DISPUTED;
        emit DisputeRaised(tradeId, msg.sender, reason);
    }

    
    
    
    function arbiterResolve(uint256 tradeId, bool buyerWins) external nonReentrant whenNotPaused {
        Trade storage t = trades[tradeId];
        require(t.status == Status.DISPUTED, "BAD_STATUS");
        require(t.arbiterPin != address(0), "DISPUTE_NOT_PINNED");
        require(msg.sender == t.arbiterPin, "ARBITER_REPOINTED");
        emit DisputeResolved(tradeId, buyerWins, msg.sender);
        if (buyerWins) {
            _settle(t);
        } else {
            t.status = Status.REFUNDED;
            _consumeOffer(t.offerId);
            IERC20(t.token).safeTransfer(t.seller, t.amount);
            emit TradeRefunded(tradeId, t.seller);
        }
    }

    
    
    
    
    
    
    function _consumeOffer(uint256 offerId) private {
        offers[offerId].cancelled = true;
        offers[offerId].activeTradeId = 0;
    }

    function _settle(Trade storage t) private {
        t.status = Status.SETTLED;
        _consumeOffer(t.offerId);
        IERC20(t.token).safeTransfer(t.buyer, t.amount);
        emit TradeSettled(t.id, t.buyer, t.amount);
    }

    
    
    function tradeClock(uint256 tradeId) external view returns (Status status, uint256 payLeft) {
        Trade storage t = trades[tradeId];
        status = t.status;
        if (t.status == Status.LOCKED) {
            uint256 deadline = uint256(t.lockedAt) + offers[t.offerId].payWindow;
            if (block.timestamp < deadline) payLeft = deadline - block.timestamp;
        }
    }
}
