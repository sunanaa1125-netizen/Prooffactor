# ProofFactor — Rise In submission packet

## Project

- **Name:** ProofFactor
- **Category:** Private B2B Invoice Verifier / Smart Compliance
- **One-line pitch:** ProofFactor lets suppliers prove an invoice is eligible for financing without exposing its commercial details.

## Problem

Invoice financing is slow because lenders need enough evidence to assess risk, while suppliers and buyers cannot safely expose amounts, due dates, references, counterparties, and margins in a public workflow. Conventional on-chain systems make this data public; conventional private systems require a trusted intermediary.

## Solution

ProofFactor uses Midnight to create a privacy-preserving invoice lifecycle:

1. A supplier registers a salted invoice commitment.
2. An authorized buyer attests to the matching private invoice and issues a stable nullifier.
3. A supplier proves policy eligibility against a lender policy without disclosing invoice facts.
4. The contract atomically creates a pending financing lock.
5. A lender confirms or declines the request; a consumed nullifier prevents a second confirmed financing inside the ProofFactor registry.

## Why Midnight

Midnight is necessary because the application needs shared, verifiable state changes while keeping invoice witnesses private. The ZK circuit proves eligibility predicates and authorizations without publishing raw invoice information. A public smart contract would disclose the data; a normal private database would not provide independent on-chain verification.

## Public and private data

| Private witness data | Public state |
|---|---|
| Invoice reference, amount, currency, due date, supplier salt | Invoice commitment |
| Supplier control secret and role secrets | Pseudonymous role identities |
| Buyer nullifier nonce | Stable nullifier after acceptance |
| Policy eligibility inputs | Lifecycle state and selected policy ID |

## Technical evidence

- Compact 0.31.1 contract with 13 circuits and generated artifacts.
- Role-derived authorization; tests reject forged authorization and invalid lifecycle paths.
- Atomic pending-financing lock plus stable-nullifier reuse protection.
- Responsive React interface for supplier, buyer, lender, and public viewer workflows.
- Midnight DApp Connector v4 wallet discovery with an explicit demo fallback.
- CI executes type checks, contract tests, UI tests, production build, and dependency audit.

## Required test cases and current result

| Test case | Evidence | Result |
|---|---|---|
| Derived admin/buyer/lender identities are domain-separated | Contract test | Pass |
| Unauthorized acceptance or confirmation is rejected | Contract test | Pass |
| Empty buyer acceptance is rejected | Contract test | Pass |
| Supplier-control forgery is rejected | Contract test | Pass |
| A stable nullifier cannot finance two commitments | Contract test | Pass |
| Pending financing expires only at the deadline | Contract test | Pass |
| Invalid lifecycle transitions are rejected | UI state-machine test | Pass |
| Private policy eligibility is evaluated locally | UI state-machine test | Pass |
| Landing wallet and proof actions remain usable | UI interaction test | Pass |
| Supplier, buyer, lender, and admin routes render correctly | UI interaction test | Pass |

**Local validation:** 20 automated tests passed: 13 application tests and 7 contract tests.

## Links and release evidence

- Repository: https://github.com/sunanaa1125-netizen/Prooffactor
- Live frontend: https://proff-factor-5674jjdnn-sm-17fa.vercel.app/
- Contract address: Pending Preprod deployment
- Deployment transaction: Pending Preprod deployment
- End-to-end Lace transaction: Pending funded Preprod wallet
- Demo video: Pending recording
- Live evidence screenshots: [landing.png](screenshots/landing.png), [workspace.png](screenshots/workspace.png), and [tests.png](screenshots/tests.png)


## Honest limitations

The currently published application is a local synthetic-data demo. It does not claim to transfer funds, validate delivery of goods, or submit live Midnight transactions. The live release requires a funded Midnight Lace Preprod wallet, a verified proof-server configuration, deployed contract artifacts, and recorded transaction evidence.

## Submission checklist

- [x] Product name, pitch, problem, privacy model, and architecture prepared.
- [x] Contract and frontend test evidence prepared.
- [x] Repository and reproducible local setup prepared.
