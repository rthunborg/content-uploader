# MVP processor inventory

This inventory covers the production data processors selected for the MVP. All production workloads and stored customer data must remain in the listed EU placement. Signed DPAs and SCCs are required where the processor is US-owned.

| Processor | MVP purpose | Personal data | Production placement | Legal basis / safeguard |
| --- | --- | --- | --- | --- |
| Supabase | PostgreSQL, email-link authentication, private object storage, queues and scheduled jobs | Account, consent, audit and media data | Stockholm, AWS `eu-north-1` | Contract performance and legitimate interest; DPA, SCCs and EU data residency |
| Vercel | Serve the private Next.js application and execute app functions | Request metadata and transient application responses; no media bytes | Stockholm `arn1` | Legitimate interest; DPA, SCCs and region pinning |
| Railway | Run media and background-job workers | Job metadata and transient media-processing files | EU West, Amsterdam | Contract performance and legitimate interest; DPA, SCCs and EU region pinning |
| Brevo | Deliver authentication and workflow email | Recipient name, email address and message delivery metadata | European Union | Contract performance and legitimate interest; DPA and EU processing |
| 46elks | Deliver workflow SMS | Recipient name, telephone number and message delivery metadata | European Union | Contract performance and legitimate interest; DPA and EU processing |

## Deferred observability

The MVP writes structured error and critical events through `src/shared/logger.ts` to the EU-pinned Vercel and Railway platform logs. Sentry is post-MVP only and is not an MVP processor, dependency or environment variable. If it is introduced later, its EU organization and data flows require a separate processor-inventory update before activation.
