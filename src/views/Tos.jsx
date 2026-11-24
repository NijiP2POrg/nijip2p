import React from "react";
import { Panel, KV } from "../lib/ui.jsx";
import { LogoMark } from "../lib/brand.jsx";
function SimplexChip({
  social
}) {
  const url = social?.simplex ?? "";
  return url ? <a className="btn accent" href={url} target="_blank" rel="noreferrer noopener">nijip2p on SimpleX ↗</a> : <span className="btn" style={{
    opacity: 0.55,
    cursor: "default"
  }} aria-disabled="true" title="The link goes live once social.simplex is set in config.json">
            nijip2p on SimpleX · link coming soon
        </span>;
}
export default function Tos({
  social
}) {
  return <div className="page">
            <h1 className="h1">Terms of Service</h1>
            <p className="lead">
                By accessing or using this interface you agree to these terms. If you do not agree, do not use it.
            </p>

            <Panel kicker="01 · the service">
                <p style={{
        margin: 0,
        fontSize: 13.5,
        lineHeight: 1.65,
        color: "var(--muted)"
      }}>
                    nijip2p is a non-custodial interface to smart contracts deployed on public blockchains.
                    The interface displays contract state and constructs transactions that are signed on the
                    user's own device. The organisation is not an crypto exchange, bank, broker or custodian,
                    does not operate the contracts, and holds no user funds, keys or cash at any time.
                </p>
            </Panel>

            <Panel kicker="02 · data">
                <p style={{
        margin: 0,
        fontSize: 13.5,
        lineHeight: 1.65,
        color: "var(--muted)"
      }}>
                    The organisation collects no personal data. There is no identity verification, no KYC and
                    no collection of documents such as PAN. Accounts consist of codes generated locally on the
                    user's device. The organisation keeps no activity logs and operates no server that can
                    observe user balances. Transactions are recorded on public blockchains and are not
                    controlled by the organisation. Communications between counterparties pass through
                    encrypted relay networks that the organisation does not operate.
                </p>
            </Panel>

            <Panel kicker="03 · taxes" sub="Responsibility for all tax obligations arising from the use of the service rests solely with the user. The organisation does not withhold, report, advise or file on the user's behalf, and holds no information with which it could do so.">
                <KV rows={[["Transfer tax (India, s. 115BBH)", "Income from the transfer of virtual digital assets is taxed at a flat rate of 30%."], ["TDS (India, s. 194S)", "The buyer in a person-to-person transfer is required to deduct 1% tax at source."], ["Disclosure (Schedule VDA)", "Each transfer is disclosed in Schedule VDA of the income tax return."], ["Large cash receipts (India, s. 269ST)", "The receipt of cash of ₹2,00,000 or more in a single transaction, day or event may attract a penalty equal to 100% of the amount received."]]} />
                <p style={{
        margin: "12px 0 0",
        fontSize: 13,
        lineHeight: 1.6,
        color: "var(--muted)"
      }}>
                    By way of example, under Indian law - as listed above. Users must determine and satisfy
                    their own obligations in their own jurisdiction.
                </p>
            </Panel>

            <Panel kicker="04 · correct use of the protocol">
                <p style={{
        margin: 0,
        fontSize: 13.5,
        lineHeight: 1.65,
        color: "var(--muted)"
      }}>
                    The contracts are immutable and perform exactly as written. The protocol protects
                    counterparties only when each follows the documented procedure: locking funds before
                    delivery, verifying facts before confirming, and confirming nothing that has not occurred.
                    Losses arising from a false confirmation, the disclosure of a private key or account code,
                    or any use outside the documented procedure are the sole responsibility of the user. The
                    organisation has no ability to reverse, restore or correct any such outcome.
                </p>
            </Panel>

            <Panel kicker="05 · compliance">
                <p style={{
        margin: 0,
        fontSize: 13.5,
        lineHeight: 1.65,
        color: "var(--muted)"
      }}>
                    The service may be used only for lawful purposes and only where its use is permitted. Users
                    are responsible for the legality of their own trades, including any statutory limits on cash
                    transactions in their jurisdiction. Fraud, coercion, sanctions evasion and the laundering of
                    criminal proceeds are prohibited.
                </p>
            </Panel>

            <Panel kicker="06 · no warranty or liability">
                <p style={{
        margin: 0,
        fontSize: 13.5,
        lineHeight: 1.65,
        color: "var(--muted)"
      }}>
                    The service is provided "as is" and "as available", without warranties of any kind. To the
                    maximum extent permitted by law, the organisation is not liable for any loss arising from the
                    use of, or inability to use, the service, including loss of funds, keys, taxes, penalties or
                    the outcome of any trade. The user indemnifies the organisation against all claims arising
                    from their use of the service. In any conflict between these terms and the smart contracts,
                    the contracts prevail.
                </p>
            </Panel>

            <Panel kicker="07 · communication">
                <p style={{
        margin: "0 0 12px",
        fontSize: 13.5,
        lineHeight: 1.65,
        color: "var(--muted)"
      }}>
                    The organisation may be reached through SimpleX Chat only. No support channel exists that
                    can override the contracts, recover a lost code or reverse a confirmation.
                </p>
                <SimplexChip social={social} />
            </Panel>

            <p className="small dim" style={{
      marginTop: 18,
      display: "flex",
      alignItems: "center",
      gap: 8
    }}>
                <LogoMark size={16} aria-hidden="true" />
                <span>nijip2p · non-custodial, non-profit, open-source. In any conflict between these terms and the smart contracts, the contracts prevail.</span>
            </p>
        </div>;
}