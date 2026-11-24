
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";


















interface INijiDeal {
    function arbiterResolve(uint256 tradeId, bool buyerWins) external;
}

contract NijiCourt is Ownable2Step {
    
    mapping(address => bool) public isArbiter;
    uint256 public arbiterCount; 
    INijiDeal public deal;

    
    event ArbiterAdded(address indexed account);
    event ArbiterRemoved(address indexed account);
    event DealSet(address indexed deal);
    event Resolved(uint256 indexed tradeId, bool buyerWins, address indexed arbiter, string note);

    
    modifier onlyArbiter() {
        require(isArbiter[msg.sender], "NOT_ARBITER");
        _;
    }

    constructor(address deal_, address initialArbiter_) Ownable(msg.sender) {
        require(deal_ != address(0), "ZERO_DEAL");
        
        
        
        deal = INijiDeal(deal_);
        require(initialArbiter_ != address(0), "ZERO_ARBITER");
        isArbiter[initialArbiter_] = true;
        arbiterCount = 1;
        emit ArbiterAdded(initialArbiter_);
    }

    
    function addArbiter(address account) external onlyOwner {
        require(account != address(0), "ZERO_ARBITER");
        require(!isArbiter[account], "ALREADY_ARBITER");
        isArbiter[account] = true;
        ++arbiterCount;
        emit ArbiterAdded(account);
    }

    
    
    function removeArbiter(address account) external onlyOwner {
        require(isArbiter[account], "NOT_ARBITER");
        require(arbiterCount > 1, "LAST_ARBITER");
        isArbiter[account] = false;
        --arbiterCount;
        emit ArbiterRemoved(account);
    }

    
    
    function setDeal(address deal_) external onlyOwner {
        require(deal_ != address(0), "ZERO_DEAL");
        deal = INijiDeal(deal_);
        emit DealSet(deal_);
    }

    
    
    
    
    function resolve(uint256 tradeId, bool buyerWins, string calldata note) external onlyArbiter {
        
        
        
        require(address(deal) != address(0), "DEAL_NOT_WIRED");
        deal.arbiterResolve(tradeId, buyerWins);
        emit Resolved(tradeId, buyerWins, msg.sender, note);
    }
}
