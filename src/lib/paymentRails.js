export const FREEZE_MECHANICS = [["1 · The complaint", "A fraud victim files on cybercrime.gov.in (NCRP) or calls 1930. The complaint names the last UPI handle, account number or card that touched their money - frequently a P2P seller's receiving account, one hop from the mule."], ["2 · The advisory", "The complaint flows through I4C to the bank (CFCFRMS / CFMC channels since 2024). Banks act on the advisory without a court order: they either mark a LIEN on the disputed amount or DEBIT-FREEZE the whole account."], ["3 · Lien vs debit-freeze vs attachment", "A lien blocks only the marked amount. A debit-freeze blocks the entire account - courts (Bombay HC among them) have held that a debit-freeze is an ATTACHMENT, which s.106 BNSS does not authorise; police may seize for evidence, attachment needs due process. In practice both happen; some states freeze 3x the disputed amount."], ["4 · The honest timeline", "De-freeze is a process, not a form: get the complaint/acknowledgement number from the bank, submit a representation to the cyber cell with KYC + statements + trade evidence, escalate to GRM/banking ombudsman, and if needed petition the Magistrate (s.497 BNSS, the old s.457 CrPC route) for release of property. Real cases run from weeks to more than a year - prevention is the whole game."], ["5 · Cash breaks the hop", "A CDM deposit or a cardless withdrawal leg carries no payer identity on the transaction. There is nothing for an advisory to point at on your side. That is why the cash rails sit at the safe end of the ladder - and why the digital rails need the hygiene rules below."]];
export const FREEZE_PLAYBOOK = [{
  t: "Before you trade - account hygiene",
  d: "Use a dedicated trade account, never your salary or savings account. Keep the float at or below your open trade amounts and sweep profits out within 24 hours. Never trade while an old freeze is unresolved. Do NOT structure deposits to dodge the PAN threshold (many sub-50k deposits in a day reads as smurfing and closes accounts - one honest deposit beats five clever ones)."
}, {
  t: "If a freeze lands - the first 48 hours",
  d: "Do not panic-withdraw anything from other accounts into it. Ask the bank IN WRITING for the freeze details: complaint/acknowledgement number, the agency, the marked amount. Respond to any notice within 48 hours. Silence is what turns a 2-week freeze into a 2-year freeze."
}, {
  t: "Build the evidence pack",
  d: "Export the sealed trade chat, the on-chain trade hashes, this rulebook's rail record for the trade, your KYC and the bank statement line for the disputed credit. One PDF, everything the representation needs - the app's export gives you the chat and hashes."
}, {
  t: "Escalate in order",
  d: "1) Representation to the cyber cell / IO. 2) Bank GRM, then the RBI Banking Ombudsman if the bank stalls. 3) Magistrate petition under s.497 BNSS for release of property. Attach the evidence pack to every step."
}, {
  t: "Trade again - on a fresh account",
  d: "While frozen, publish offers from a different dedicated account and switch your accepted rails toward the cash legs. The account is a consumable; the rulebook is what keeps the next one safe."
}];
export const ARBITRATOR_CODE = [["Buyer paid from a name that does not match their verified identity", "Proof: bank ledger credit line + UTR.", "Default: buyer's fault unless the seller accepted it in the sealed chat BEFORE payment. Seller refunds to the same source account and the trade unwinds."], ["A third party sent the payment", "Proof: payer name on the credit.", "Default: buyer's fault. The trade unwinds with a same-source refund; the seller is never obliged to release for money that arrived from a stranger."], ["Buyer claims paid, no UTR/reference produced", "Proof: UTR, CDM reference or receipt number.", "Default: the seller's 'no credit' stands. Payment claims without a reference are treated as not paid."], ["NEFT shows 'debited' but no credit in the seller's ledger", "Proof: seller's ledger line vs buyer's debit advice.", "Default: release only on ledger credit. 'Debited from my side' is not 'received'. The trade waits or the buyer disputes after the window."], ["CDM deposit, reference number provided, seller disputes amount", "Proof: CDM slip ref + credit SMS + ledger line.", "Default: the bank's recorded credit is the amount that counts. Machine slips and the ledger outrank any screenshot."], ["Gift card code dead on arrival (already redeemed)", "Proof: chat-timestamped code + official redemption history date.", "Default: buyer's fault - buyer must send a replacement code within the payment window or the trade unwinds."], ["Gift card voided after successful redemption", "Proof: redemption timestamp vs the 24-hour settlement hold.", "Default: voids reported within 24h of redemption - buyer replaces the value. After 24h the residual risk is the seller's, openly accepted by trading this rail."], ["Account-switch request mid-trade ('send to my other account')", "Proof: sealed chat.", "Default: automatic red flag. Refusing it is always right; complying voids the trade's protection - the arbiter will not follow money to an off-record account."], ["Seller's account frozen BEFORE the buyer paid", "Proof: freeze notice screenshot.", "Default: no fault - the trade simply cannot complete. The escrow returns to the seller; the buyer walks away whole."], ["Seller's account frozen AFTER payment, before release", "Proof: freeze notice + buyer's payment proof.", "Default: the buyer's payment is a fact, so the ruling prefers the buyer - release to the buyer, unless the seller proves an alternate-rail settlement was agreed in chat. The freeze notice is the seller's problem, not the buyer's shield."], ["Seller's account frozen AFTER release", "Proof: nothing needed - trade is settled.", "Default: the trade stands. The platform hands the seller the evidence pack for their de-freeze representation; the buyer keeps the coins."], ["In-person: no Proof-of-Record artifacts at all", "Proof: none exists.", "Default: cash delivery is UNPROVEN. The escrowed coins return to the seller and the buyer bears the loss. The ceremony exists precisely so a real buyer can prove payment - record it."], ["In-person: counting video + session code exist, seller still disputes", "Proof: continuous video, session-code photos, geotag stamps, deposit receipt.", "Default: the record wins. Release is enforced; a seller who took the cash and disputes anyway loses the dispute and the reputation."], ["In-person: counterfeit notes on the counting video", "Proof: FIR + the video.", "Default: coins stay locked until police/court direction; the platform assists both parties. Cash value is whatever the genuine notes count to."]];
export const POR_ARTIFACTS = [["Escrow lock hash", "The on-chain transaction that locked the coins - checked by BOTH sides in their own app before anyone travels."], ["Session code", "A one-time 6-digit code the app generates for this meet. Written on paper, it appears in the check-in photo - proof the artifacts belong to THIS day and THIS meet, not a replay of an old one."], ["Check-in stamp", "Both sides tap 'arrived': geotag + time, plus one photo of the surroundings with the branch/location visible."], ["Counting video", "One continuous, uncut video of the full count - a note-counting machine at the branch is best. Cuts are treated as edits."], ["Deposit receipt", "If the meet is at a branch: the CDM/counter receipt with its reference number, deposited within banking hours."], ["Mutual confirmations", "Buyer taps 'cash delivered', seller taps 'cash received & counted' - both stamped inside the session window, then the artifacts are hashed and referenced in the sealed chat."]];
export const RAILS = [{
  id: "upi",
  name: "UPI",
  short: "UPI",
  tag: "Instant bank payment. The most convenient rail in India - and the one that drags the freeze risk behind it.",
  lien: {
    level: "HIGH",
    note: "A cyber-complaint on the payer's UPI transaction points at the receiving account in one hop. Lien or debit-freeze can land within hours of a 1930 call."
  },
  clawback: {
    level: "LOW",
    note: "A completed UPI credit cannot be pulled back. The buyer's real risk is paying the wrong account - the rules below remove it."
  },
  speed: "Instant, 24x7",
  caps: [["Per transaction", "₹1,00,000 NPCI standard cap - your bank's own UPI limit may be lower; category exceptions exist. Confirm in your bank app before a large trade."], ["Practical trade size", "Split large trades into several offers rather than several payments into one account."]],
  best: "Small trades between parties who accept the freeze hygiene burden - and sellers who run a dedicated, swept trade account.",
  window: {
    fit: "ok",
    note: ""
  },
  why: "UPI is where the fraud complaints are: it is the rail every scam victim used, so it is the rail every advisory references. The complaint quotes a UPI transaction ID; the bank resolves it to YOUR account; the lien lands without anyone asking you a question first. The rail itself is excellent - the exposure is purely that the money is traceable to a named account pair in a single hop.",
  buyerRules: ["Pay only from your own account - the name on the sending bank account must match your verified identity on the platform. A mismatch hands the dispute to the seller by default.", "Send the exact amount in ONE transfer. Part-payments are a dispute pattern; if the rate changed, cancel and re-take, don't improvise.", "Capture the UTR (12-digit reference) plus the last 4 digits of the sending account BEFORE marking the trade paid.", "Mark paid only when your bank app shows the transfer as SUCCESS - not 'processing', not a screenshot of a draft.", "Never pay an account other than the one named in the sealed chat, even if 'the seller' asks. Account-switch requests are the oldest scam in the book - refuse and dispute.", "Never route the payment through a friend's or relative's account. Third-party payments are an automatic dispute loss for the buyer.", "Keep the payment receipt and do not delete anything from the chat - the sealed thread is the evidence the arbiter reads."],
  sellerRules: ["Use a dedicated trade account - never your salary or savings account. Keep its float at or below your open trade amounts and sweep it out within 24 hours of every credit.", "Before releasing, the payer name on the incoming credit MUST match the buyer's verified identity. Mismatch: do not release - refund to the same source account and open a dispute.", "Verify the credit in your bank app's LEDGER, not from an SMS - SMS can be spoofed, the ledger cannot.", "Record the incoming UTR against the trade id in the sealed chat before you release.", "Received from a stranger or a mismatched name? Refund to the SAME source account, cancel, and note it in the chat. Never release crypto for money from a third party.", "Answer any bank or cyber-cell notice within 48 hours, with the sealed chat exported. Response time is the single biggest factor in how fast a freeze clears.", "If your account has an unresolved freeze, stop trading on it and move offers to a fresh dedicated account."],
  evidence: ["The UTR of the incoming credit", "The seller's bank ledger line (amount, date, payer name)", "Last 4 digits of the sending account", "The sealed chat where the receiving account was named"],
  defaults: [["Name mismatch or third-party payer", "Buyer's fault unless the seller accepted it in chat before payment; same-source refund, trade unwinds."], ["Paid claim without a UTR", "Treated as not paid."], ["Seller refuses to release despite a clean matched credit", "Arbiter enforces release - the ledger line is decisive."]],
  pitfalls: ["'I paid, see screenshot' with no UTR and no credit - refuse until the ledger shows it.", "Spoofed SMS 'credits' - the ledger is the only truth.", "Overpayment trick: buyer sends more than the rate, asks for the excess back over a different rail. Refuse: same-rail adjustment or dispute.", "Collect-then-switch: 'my UPI is down, send to this other number' - always refuse."]
}, {
  id: "bank",
  name: "NEFT / IMPS / RTGS",
  short: "Bank",
  tag: "Classic bank transfer. Same single-hop traceability as UPI - the trail is the account pair, and every credit is named.",
  lien: {
    level: "HIGH",
    note: "Identical exposure to UPI: a complaint names the receiving account and the bank blocks it. RTGS amounts are larger, so the lien is larger too."
  },
  clawback: {
    level: "LOW",
    note: "Completed credits are final. The buyer's risk is again the wrong account or a wrong amount - both solved by following the rules."
  },
  speed: "IMPS instant · NEFT half-hourly batches · RTGS instant - all 24x7",
  caps: [["IMPS", "₹5,00,000 per transaction (banks often set lower)."], ["NEFT", "No RBI minimum or maximum; your bank may cap it. Credits land in half-hourly batches - do not release on 'debited from my side'."], ["RTGS", "Minimum ₹2,00,000, no upper cap. Only for the largest buckets - and expect the bank to ask about a ₹5L+ credit."]],
  best: "Large stablecoin trades where both sides are comfortable with full traceability, and NEFT-only accounts that UPI cannot reach.",
  window: {
    fit: "warn",
    note: "IMPS and RTGS are instant and fit the window. NEFT settles in half-hourly batches - the payment window does not stretch for batches."
  },
  why: "NEFT, IMPS and RTGS are the same story as UPI with slower clocks: full name-to-name traceability, so the advisory hop is trivial. The one rail-specific trap is NEFT's batch settlement - 'I sent it' and 'I received it' can be 30 minutes apart, and releasing on faith in that gap is how sellers get burned. RTGS's ₹2L floor makes it a big-trade rail; treat any RTGS-sized credit as one the bank will scrutinise.",
  buyerRules: ["Pay only from your own KYC-matched account; the sending name must match your verified identity.", "IMPS/RTGS: treat like UPI - one transfer, exact amount, capture the UTR before marking paid.", "NEFT: check the batch schedule. If the credit will not land inside the 20-minute payment window, do NOT take the trade - take a UPI/IMPS offer instead. The window does not stretch for batches.", "Confirm the transfer shows SUCCESS in your bank app, and screenshot the confirmation with the reference number.", "Never pay a different account than the one in the sealed chat; never route through a third party.", "For RTGS-sized trades, expect and welcome the seller's questions - a clean paper trail is the point of this rail."],
  sellerRules: ["Release on LEDGER CREDIT only - never on a debit advice, a 'swift copy' or a screenshot of the buyer's app. NEFT batches make fake-credit screenshots cheap.", "Match the payer name to the buyer's verified identity before release; mismatch = same-source refund + dispute.", "Record the UTR and the exact credit timestamp in the sealed chat against the trade id.", "Keep the dedicated-account hygiene: float at open-trade amounts, sweep within 24 hours.", "For RTGS credits, keep the trade's evidence pack ready - large cash-equivalent credits are what freeze advisories look for.", "Answer bank/cyber-cell notices within 48 hours; escalate GRM → ombudsman → s.497 BNSS petition if a freeze does not clear."],
  evidence: ["UTR / RTGS reference number", "Seller's ledger credit line", "Sending account name and last 4 digits", "Sealed chat account details"],
  defaults: [["'Debited from my side' vs no credit in ledger", "Release waits for the ledger. The window expiring without credit pushes the refund; the buyer can dispute a stale NEFT with the UTR."], ["Name mismatch / third-party sender", "Buyer's fault by default; same-source refund, unwind."], ["No UTR produced", "Treated as not paid."]],
  pitfalls: ["Screenshot of 'money sent' from the buyer's own app - worthless until the ledger agrees.", "NEFT batch delay exploited to force a rushed release - the window protects you; let it.", "RTGS from a company account 'for convenience' - third-party rule applies in full."]
}, {
  id: "cdm",
  name: "CDM - cash deposit machine",
  short: "CDM",
  tag: "Cash into the machine, credit in minutes. No payer identity rides the transaction - which is exactly why it stays off the freeze radar.",
  lien: {
    level: "LOW",
    note: "A CDM credit carries no sender account. There is nothing for an advisory to point at on your side. Operator experience: smooth, no lien marks. Keep the receipts anyway."
  },
  clawback: {
    level: "NONE",
    note: "Cash handed to a machine cannot be charged back or reversed. Count carefully - the machine slip is the whole proof."
  },
  speed: "Credit in minutes (some banks instantly)",
  caps: [["Per transaction", "Typically ₹49,900 cardless CDM per transaction (bank-dependent)."], ["PAN threshold", "Cash deposits of ₹50,000+ in a day require quoting PAN (Form 60 without one). Depositing just under it, repeatedly, is smurfing - banks close accounts for it."], ["Automatic reporting", "Banks file a CTR to FIU-IND for cash deposits above ₹10,00,000 aggregated in a day. That is routine legal reporting, not a freeze - but it is a footprint."], ["Session discipline", "Keep in-person sessions modest; one honest deposit of the full trade amount beats a stack of clever ones."]],
  best: "The workhorse rail for Indian P2P: sellers who want no payer trail, buyers who hold cash. Works for both stablecoin desks and funding a cash-in-person session.",
  window: {
    fit: "ok",
    note: ""
  },
  why: "This is the rail that runs smoothly in practice, and the mechanism explains the operator experience: a cyber advisory freezes ACCOUNT-TO-ACCOUNT traces, and a CDM deposit simply does not carry one. The money appears as cash with a machine reference. Investigation can still follow chat and references - nothing here is invisible - but the automated golden-hour lien has no handle to grab. The trade-offs are physical: counterfeit notes, jammed cash, and the tax thresholds, all handled by the rules below.",
  buyerRules: ["Deposit ONLY to the account number displayed in the escrow desk / sealed chat. Copy it into the machine; verify the last 4 digits on the confirmation screen before inserting cash.", "Count and fan the notes BEFORE inserting. The machine rejects soiled/notes at its own judgment - a rejected note is the buyer's to replace, so feed clean currency.", "Keep the machine slip: it carries the CDM reference number, timestamp and truncated account. That slip is the trade's evidence.", "Screenshot the credit SMS and, if possible, a mini-statement line showing the credit.", "Deposits below ₹50,000/day need no PAN at the machine; do NOT split a large trade into many just-under deposits - that pattern flags as structuring. Larger single deposits with PAN are cleaner.", "No third-party deposits: whoever's hand feeds the machine, the buyer owns the proof. If someone else deposits for you, the trade still shows YOUR responsibility.", "Enter the CDM reference number in the sealed chat when you mark the trade paid."],
  sellerRules: ["Confirm the credit in your bank LEDGER (amount + CDM reference) before releasing - the machine slip alone is the buyer's proof, the ledger is yours.", "Match the credited amount exactly to the trade. Short credits: wait for the balance or unwind - never release short.", "Photograph/keep every deposit slip against the trade id in the sealed chat.", "Keep your dedicated-account hygiene: sweep within 24 hours; do not stack repeated sub-threshold deposits - one honest deposit per trade.", "Expect the bank to ask about cash inflows; the sealed chat + slips are your clean answer. Answer any notice within 48 hours.", "If your account takes an unrelated freeze, CDM credits continue arriving to a FROZEN account - stop publishing offers until it clears and move trades to a fresh account."],
  evidence: ["CDM reference number from the machine slip", "Credit SMS / mini-statement line", "Seller's ledger credit line", "Sealed chat with the account number and reference"],
  defaults: [["Reference provided, amount matches ledger", "The ledger is decisive; release is enforced."], ["No CDM reference produced", "Treated as not paid - same as a missing UTR."], ["Credit landed after the payment window expired", "The refund rule stands; the buyer's remedy is the dispute with the slip, and the arbiter can still rule release on a proven credit made in good faith during the meet."]],
  pitfalls: ["'I deposited, machine ate the slip' - no reference, no proof; the ledger decides.", "Wrong account digit - the machine credits a stranger; that money is the buyer's loss. Verify last 4 on screen.", "Note-jam scam claims - machines return rejected notes; the slip lists accepted ones.", "Structuring: many ₹49,000 deposits in a day - banks close accounts for it. One deposit per trade."]
}, {
  id: "cardless",
  name: "Cardless cash withdrawal (CCW) → CDM",
  short: "CCW",
  tag: "Withdraw by OTP, deposit by machine. Both legs are cash - the smallest digital footprint a trade can have.",
  lien: {
    level: "LOW",
    note: "Neither leg carries a payer account on the transaction: the withdrawal is your own bank's OTP flow, the deposit is anonymous cash. Operator experience: the smoothest combination there is."
  },
  clawback: {
    level: "NONE",
    note: "Cash cannot reverse. The buyer's only risk is physical - handled by the OTP and counting rules."
  },
  speed: "Withdrawal instant · credit in minutes",
  caps: [["Cardless withdrawal (ICCW)", "Typically ₹10,000 per transaction and ₹10,000–25,000 per day, per bank."], ["UPI-ATM (RuPay)", "Around ₹10,000 per transaction where supported."], ["Plan the session", "A ₹1,00,000 trade means several withdrawal trips across the day/week - schedule it, and never withdraw in front of strangers at the ATM."]],
  best: "Buyers who hold bank balance but want zero account-trace into the trade, feeding the CDM rail. The cleanest chain for the seller's side: cash in, no name attached.",
  window: {
    fit: "warn",
    note: "Two cash legs with daily caps - plan the trips. Take the offer only when you can finish withdrawal AND deposit inside the payment window."
  },
  why: "This is a funding pattern, not just a rail: the buyer converts their own balance to cash by OTP (no card, no cheque, no transfer slip), then walks the cash into the CDM leg. Every hop the digital rails expose - payer name, account pair, UTR - is absent. The withdrawal SMS names the buyer's own bank, but that is the buyer's own trail, not one the seller's account carries. The discipline points are OTP hygiene (the classic empty-account scam is an OTP phish) and the CDM rules above, which apply unchanged.",
  buyerRules: ["Withdraw only through YOUR OWN bank app's cardless flow (ICCW/UPI-ATM). Never through an app someone else 'helps' you install.", "The OTP is for the ATM keypad ONLY. Anyone asking you to read out, forward or 'verify' an OTP in chat is emptying your account - refuse and report them.", "Keep the withdrawal SMS as your funding record; it stays yours.", "Then run the CDM rules exactly: right account, last-4 check, count first, keep the slip, single honest deposit.", "Respect the daily caps - if the trade exceeds what you can withdraw today, take a smaller trade or wait. Do not borrow someone else's card/bank to 'finish faster'.", "Do not withdraw at odd hours or unfamiliar ATMs; the physical rules of cash apply to you too."],
  sellerRules: ["Nothing changes on your side: this rail lands as a CDM credit. Run the CDM seller rules exactly.", "If the buyer offers to 'hand the cash instead', that is the cash-in-person rail - switch to its ceremony before anything moves.", "Keep the ledger line + CDM reference against the trade id as always.", "Sweep within 24 hours and keep one deposit per trade - the hygiene rules are what keep this rail smooth."],
  evidence: ["CDM reference number (the decisive artifact)", "Credit SMS / ledger line", "Buyer's withdrawal SMS (funding record, buyer-held)", "Sealed chat"],
  defaults: [["CDM reference + ledger credit match", "Decisive; release enforced."], ["Buyer claims withdrawal failed mid-trade", "The payment window still applies - cancel or complete; an unfinished withdrawal is not a dispute, it is a timing problem."], ["Any OTP-sharing incident", "Outside the protocol: OTP was never to be shared. Losses sit with whoever shared it."]],
  pitfalls: ["OTP phishing - the #1 way this rail goes wrong. The ATM keypad is the only place an OTP is ever typed.", "Borrowed bank apps/accounts to beat daily caps - third-party rule, refused.", "Skipping the last-4 check because 'it's cash anyway' - wrong account is still the buyer's loss."]
}, {
  id: "giftcard",
  name: "Gift cards (any GC)",
  short: "Gift card",
  tag: "Any gift card both sides agree on. No bank account of yours is ever involved - there is nothing to lien; the risk moves into the code itself.",
  lien: {
    level: "NONE",
    note: "No bank account touches the trade, so there is no account to freeze or lien. This is the safest rail on the freeze axis."
  },
  clawback: {
    level: "MEDIUM",
    note: "The SELLER carries this rail's real risk: codes bought with stolen cards can be voided later, and dead-on-arrival codes are common. The 24-hour settlement hold caps that exposure, openly."
  },
  speed: "Minutes - bounded by how fast the seller redeems",
  caps: [["Discount", "Gift cards trade below face value; the offer's rate already carries the discount. Do not 'adjust' it off-platform."], ["Settlement hold", "24 hours. Voids reported within 24h of redemption are the buyer's to replace; after 24h the residual risk is the seller's, by predefined default."], ["Card scope", "Only cards whose balance can be verified on an official page and redeemed to a wallet/balance (Amazon Pay, Flipkart, Google Play, Steam, and similar). No physical-code-by-post trades."]],
  best: "Sellers who rank freeze-immunity above everything, and buyers who can source clean cards. Small-to-medium trade sizes.",
  window: {
    fit: "ok",
    note: ""
  },
  why: "On the freeze axis this rail is untouchable: no UTR, no account pair, no advisory hop. The risk does not vanish - it changes shape. Codes bought with stolen payment methods get disabled after redemption; codes get 'already redeemed' the moment they change hands; screenshots of balances are trivially faked. Amazon's own guidance is blunt: once a code is shared, treat the funds as spent. So the rules compress the trust window: the code moves ONLY through the sealed chat, the seller redeems within 15 minutes, and the 24-hour hold defines exactly who carries a later void.",
  buyerRules: ["The card must be genuine, activated and unscratched when you send it. Film the scratching/reveal in ONE continuous take - cuts are treated as edits.", "Screenshot the official balance-check page with the code partially visible and today's date before sending.", "Send the code ONLY through the sealed chat. A code sent over WhatsApp/SMS/anywhere else is outside the protocol and unprotected.", "Full codes only - no 'half now, half after release'. Partial codes are a dispute pattern; refuse and re-offer.", "Do not send codes you did not buy cleanly. A stolen code survives minutes, ruins the seller, and hands the dispute to them with your chat trail attached.", "Mark the trade paid with the code's chat timestamp; the arbiter reads the thread, not your memory."],
  sellerRules: ["On receiving the code, redeem or balance-check it within 15 minutes through the OFFICIAL channel only (Amazon Pay → add to balance; the brand's own balance page). Never via a third-party 'checker' site.", "Screenshot the successful redemption with its timestamp BEFORE releasing.", "Invalid / already-redeemed / wrong-region code: open the dispute immediately with the chat code + the failed redemption attempt. The buyer replaces the code inside the payment window or the trade unwinds.", "Spend the redeemed balance down within 24 hours - you are carrying the void risk for exactly 24 hours, no longer, by predefined default.", "A void reported within 24h: the buyer replaces the value. After 24h: your residual risk, stated openly here - the arbiter will not reopen a settled trade past the hold.", "Never accept a code 'verified' by a screenshot alone - always your own redemption attempt. Screenshots are the forgery vector on this rail."],
  evidence: ["The chat-timestamped code (sealed thread)", "The seller's redemption/balance screenshot with timestamp", "The buyer's purchase record (shown on dispute)", "The official balance-check page state"],
  defaults: [["Dead on arrival (already redeemed before sending)", "Buyer's fault - redemption history dates prove it; replace within the window or unwind."], ["Void within the 24-hour hold", "Buyer replaces the value."], ["Void after the 24-hour hold", "Seller's residual risk; the trade stands."], ["'Balance screenshot' without a successful redemption", "Worthless. The seller's own redemption attempt is the only balance that counts."]],
  pitfalls: ["Balance-check forgeries (edited HTML, dev-tools screenshots) - always redeem, never trust a picture.", "Region-locked codes - check the card's region before accepting the trade.", "'Let's do the code outside the app' - the sealed chat is the only evidence the arbiter can read.", "Repeated small voids from one buyer - reputation exists; use it."]
}, {
  id: "inperson",
  name: "Cash in person - Proof-of-Record",
  short: "In person",
  tag: "Hand-to-hand cash under the GPS-pinned meetup ceremony. Tokens lock in the cash contract before anyone travels; both phones prove the same ~150 m grid square at the venue; the record neither side can deny.",
  lien: {
    level: "NONE",
    note: "No bank transaction exists at all - the lien axis is empty. The real risks are physical: counterfeit notes, short counts, robbery. The ceremony is engineered against exactly those."
  },
  clawback: {
    level: "NONE",
    note: "The buyer's structural risk - handing cash and hoping - is removed by the escrow itself: the coins are contract-locked BEFORE anyone travels. What is left is cash quality, and the counting video answers it."
  },
  speed: "One session, ~30–60 minutes at the venue",
  caps: [["Default session cap", "₹2,00,000 of cash per session. Larger trades split into sessions, or run at a bank branch with an immediate CDM/counter deposit."], ["Location class", "Bank branch during banking hours (strongest - counting machine, UV check, deposit receipt, guards) or a public CCTV zone. Daylight, 09:00–17:00 only."], ["Never", "Vehicles, homes, hotel rooms, ATM alcoves, 'my driver will meet you', after-dark meets. Refusing these is always correct."]],
  best: "Sellers who want maximum protection moving cash-value, buyers who hold physical cash, and every trade too large or too sensitive for the machine rails.",
  window: {
    fit: "ok",
    note: "Native to the Cash desk's own clock, not a payment window: the seller locks the escrow and pins the venue by GPS, the meetup sits 2h-60d out, check-ins open around the slot, and a 30-minute cool-off guards the settle. Take a listing when the slot genuinely works for you - then just be there."
  },
  why: "In-person cash is the oldest rail and the newest risk surface: no digital trail means no lien - and also no receipt unless you manufacture one. The Proof-of-Record ceremony manufactures exactly that record, step by step, while the escrow removes the trust gap in both directions. The seller's protections are structural: the coins only release after the count is on video and the cash is (ideally) already deposited at the branch. The buyer's protections are structural too: the coins are locked on-chain before a single note changes hands, and the ceremony's artifacts are the buyer's proof if the seller ever disputes. The platform's protection is the arbitrator's code: with no artifacts, cash delivery is unproven - so both sides WANT the record.",
  buyerRules: ["Before travelling, verify the escrow lock in YOUR OWN app - open the trade, confirm the state is LOCKED and read the tx hash. No lock, no travel, ever.", "Carry exactly the agreed amount; do not round up 'to be safe'. The count video must show the full amount in one take.", "Attend the right place at the right time: branch banking hours or public CCTV zone, daylight only. A location change requested last minute is an abort signal - refuse it.", "Cooperate with the ceremony: check-in tap, session-code photo, continuous counting video. You WANT the record - it is your proof of payment.", "Hand cash only after your own app shows the lock, and never release your claim by leaving early: the seller's release happens at the table.", "Feel unsafe? Use the abort word in the app and leave. The escrow stays locked; a re-meet or a cancel is always available. Safety outranks every rule here."],
  sellerRules: ["Confirm the lock in your own app before the meet; the coins are already escrowed - your job is the cash record, not trust.", "Count on camera, one continuous take, note-counting machine preferred. State the denominations; let the machine verify authenticity at the branch.", "Branch meets: deposit the cash at the CDM/counter IMMEDIATELY, within banking hours, and photograph the receipt. Cash that never leaves the branch is cash that cannot be robbed back.", "Release only after the count video exists AND your own deposit receipt (or a completed mutual count outside branch hours) is in hand. No artifacts, no release - that default protects you.", "Both confirmations (buyer 'cash delivered', you 'cash received & counted') are tapped at the table, inside the session window, then the artifacts are hashed into the sealed chat.", "Bring a companion if you like - they stay out of the count frame and off the video. A last-minute 'extra people' arrival is an abort signal.", "Robbery or duress: comply, stay safe, then file the FIR and open the dispute with the FIR number. The predefined default on duress: escrow refunds you, coins never move against violence."],
  evidence: ["The escrow lock tx hash", "The one-time session code in the check-in photos", "Both geotagged 'arrived' stamps", "The continuous counting video", "The branch deposit receipt (CDM reference)", "Both mutual confirmations + the sealed chat"],
  defaults: [["No Proof-of-Record artifacts at all", "Cash delivery is UNPROVEN: coins return to the seller, buyer bears the loss. Record your handover."], ["Full record exists, seller disputes anyway", "The record wins; release is enforced."], ["Counterfeit notes on the video", "FIR required; coins stay locked until police/court direction; value = the genuine notes counted."], ["Either side no-shows 30+ minutes", "Auto-cancel; the escrow returns; a reputation strike goes to the no-show."], ["Duress / robbery with FIR", "Escrow refunds the seller; nothing releases against violence."]],
  pitfalls: ["'Meet me around the corner instead' - location games are the prelude to every in-person scam. Refuse.", "Counting cut short / hands out of frame - restart the take; edits void the record.", "'Release first, then I'll count' - never. The order is fixed: lock → count → deposit → release.", "Fake-escort arrivals after check-in - abort, re-meet another day.", "Note the honest residual: police attention to large cash can happen anywhere; the branch meet with a receipt is your clean answer."]
}];
export const CEREMONY = [{
  t: "S1 · Check-in",
  d: "Both tap 'arrived' - geotag and time are stamped. One photo of the surroundings (branch name or CCTV zone visible) with today's session code written on paper in frame. That photo ties every later artifact to THIS meet, not a replay."
}, {
  t: "S2 · Verify the lock",
  d: "The buyer opens the trade in their own app and both screens show the same trade id in LOCKED state with the same tx hash. Coins confirmed escrowed before any cash shows."
}, {
  t: "S3 · The count",
  d: "One continuous, uncut video of the full count. A branch note-counting machine is best - it also authenticates the notes. Denominations stated on camera. Cuts are treated as edits."
}, {
  t: "S4 · Deposit (branch meets)",
  d: "The seller deposits at the branch CDM/counter within banking hours and photographs the receipt with its reference number. The cash never leaves the zone."
}, {
  t: "S5 · Mutual confirmation",
  d: "Buyer taps 'cash delivered'; seller taps 'cash received & counted' - both inside the session window."
}, {
  t: "S6 · Release & seal",
  d: "The seller releases at the table; the contract pays the buyer. Artifact references are hashed and noted in the sealed chat - the trade's Proof of Record, complete."
}];
export const IN_STATES = [["AP", "Andhra Pradesh"], ["AR", "Arunachal Pradesh"], ["AS", "Assam"], ["BR", "Bihar"], ["CG", "Chhattisgarh"], ["GA", "Goa"], ["GJ", "Gujarat"], ["HR", "Haryana"], ["HP", "Himachal Pradesh"], ["JH", "Jharkhand"], ["KA", "Karnataka"], ["KL", "Kerala"], ["MP", "Madhya Pradesh"], ["MH", "Maharashtra"], ["MN", "Manipur"], ["ML", "Meghalaya"], ["MZ", "Mizoram"], ["NL", "Nagaland"], ["OD", "Odisha"], ["PB", "Punjab"], ["RJ", "Rajasthan"], ["SK", "Sikkim"], ["TN", "Tamil Nadu"], ["TS", "Telangana"], ["TR", "Tripura"], ["UP", "Uttar Pradesh"], ["UK", "Uttarakhand"], ["WB", "West Bengal"], ["AN", "Andaman & Nicobar"], ["CH", "Chandigarh"], ["DN", "Dadra & Nagar Haveli and Daman & Diu"], ["DL", "Delhi"], ["JK", "Jammu & Kashmir"], ["LA", "Ladakh"], ["LD", "Lakshadweep"], ["PY", "Puducherry"]];
export const STATE_BY_CODE = Object.fromEntries(IN_STATES);