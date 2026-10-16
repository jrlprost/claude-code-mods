# jr-stripemrr

Your Stripe numbers above the prompt, so you see the business while you build it.

```
mrr 4,320 € · today 149 €
```

`/jrmrr details` opens the detail:

```
jr mrr   updated 14:05
4,320 €     149 €     5,980 €
MRR         today     last 30 days
▂▃▁▅▂▆▃▂▄▇▂▃▅▆▂▁▃▅▆▇▃▂▄▅▆█▃▂▄▅
30 days ago               today
```

- **MRR** adds up active (and past-due) subscriptions, every item's price × quantity brought to a month: yearly ÷ 12, weekly × 52 ÷ 12, every N months ÷ N. Discounts and coupons are not taken off.
- **Revenue** is succeeded charges minus refunds, per local day.
- When your account uses several currencies, the figures are in the one most used; the others are left out.
- Figures refresh every 15 minutes, and when you open `/jrmrr details`.

## Setup

Create a **restricted key** in the Stripe dashboard (Developers → API keys → Create restricted key) with **Read** on **Charges** and **Subscriptions**, nothing else. Paste it in `/config` under jr-stripemrr. It is stored as a secret.

## Commands

| Command | |
| --- | --- |
| `/jrmrr` | Hide or show the band (it toggles); `/jrmrr hide` and `show` set it |
| `/jrmrr details` | Open MRR, today and the 30-day sparkline |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Stripe restricted key | | Read access to Charges and Subscriptions |
| Show the band | on | MRR and today above the prompt |

## Install

```
/plugin install jr-stripemrr --marketplace jrlprost/claude-code-mods
```

## Access

Calls `api.stripe.com` with your restricted key: lists charges of the last 30 days and active subscriptions, read only. Keeps the figures in memory for the session. Writes nothing, runs nothing.
