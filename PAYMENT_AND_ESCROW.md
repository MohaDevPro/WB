# Payments and Escrow-like Settlement

WK uses a payment abstraction layer so multiple providers can be integrated without coupling business logic to one gateway.

Target provider integrations may include mada, STC Pay, Apple Pay, Visa/Mastercard-capable gateways, Stripe, and other approved providers where commercially and legally available.

The transaction engine supports authorization, hold, delivery, acceptance, settlement, payout, refund, cancellation, dispute, chargeback handling, reconciliation, and financial audit.

WK should use regulated payment-provider infrastructure for holding funds. Do not implement an unlicensed internal wallet or assume WK may legally custody customer funds.

Financial operations require idempotency, reconciliation, auditability, segregation of duties, and strict access control.
