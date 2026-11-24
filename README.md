# nijip2p

non-custodial p2p escrow on bnb chain. two parties commit a deal to a smart contract;
the contract holds the funds, enforces the terms and settles on the chain itself.
every step is a public transaction.

- live app: https://app.nijip2p.me
- docs: https://app.nijip2p.me/docs
- verify the deployment on your own device: https://app.nijip2p.me/verify
- deployment tx: `iIRNtyb8NWwHLtMsMHW-l-30LFWw2V5fUgIKgNE8nHw`

## the stack

- react + vite, bnb chain (chain 56) through ethers
- escrow: NijiDeal `0xe0c15288dd4e2abb4b362ffe9663d92c36b37147`
- arbitration: NijiCourt `0x675ab5fccc672a9c450847b140169ef0e76eab1b`
- a fixed, public arbiter: `0x936092A84f3ceFB4fa4C2BeCefAaf242d2A32B70`
- a minimal nostr relay for the sealed chat, presence and offer metadata
  (kind 20001/20002/20078, sealed messages 1059/13)

## the layout

```
src/
  lib/          account derivation, the secret store, chain helpers, the gas engine,
                the board engine, offer metadata
  chat/         the nostr relay pool and presence (kind 20001)
  components/   auth sheet, send-all, rail picker, map picker
  views/        landing, account, desks (remote + in-person), how it works
public/         config.json, brand assets, the favicon
NijiDeal.sol    the escrow contract
NijiCourt.sol   the arbitration contract
```

## the account model

an anonymous recovery code is generated on the device: 24 chars from a 32-symbol
alphabet (120 bits) plus a checksum. the seed is PBKDF2-SHA-256 (200,000 rounds,
512 bits) from that code; the evm key and the chat identity derive from the seed.
the code is shown once and never stored anywhere - the tab session holds it, the tab
closes, the code is the only way back. that is stated in the creation ceremony.

## run it

```
npm install
npm run dev      # http://localhost:8080
npm run build    # production build
```

the build leaves the money-handling modules un-minified on purpose (see
vite.config.mjs): the chunk that moves funds is readable file-for-file on the deployed
site. everything else is minified normally.

## verify the deployment

the live app is pinned on arweave. open app.nijip2p.me/verify on any device: it
downloads the pages and files from the domain and the same bytes from the deployment
transaction, hashes both with sha-256 and compares. no trust required.

## the contracts collect nothing

no platform fee, no listing fee, no settlement fee. the only cost is gas, measured
live before every signature. at the current floor (0.05 gwei) publishing an offer
costs about 0.00000843 bnb.

## the honest limits

the recovery code is unrecoverable by design: lost code, lost funds. the ceremony says
it before you create anything. on-chain activity is pseudonymous, not anonymous. the
arbiter is human: one binary ruling, public on-chain.
