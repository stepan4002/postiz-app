import { TemporalModule } from 'nestjs-temporal-core';
import { socialIntegrationList } from '@gitroom/nestjs-libraries/integrations/integration.manager';

// Personal/self-hosted deployments: cap worker concurrency to save memory.
// Set TEMPORAL_MAX_CONCURRENT_JOBS in .env to override (default: 3 for personal use).
// Set to 0 or 'unlimited' to use the per-provider SaaS defaults.
const MAX_CONCURRENT_OVERRIDE = process.env.TEMPORAL_MAX_CONCURRENT_JOBS;
const concurrencyCap =
  MAX_CONCURRENT_OVERRIDE === '0' || MAX_CONCURRENT_OVERRIDE === 'unlimited'
    ? Infinity
    : parseInt(MAX_CONCURRENT_OVERRIDE || '3', 10);

export const getTemporalModule = (
  isWorkers: boolean,
  path?: string,
  activityClasses?: any[]
) => {
  return TemporalModule.register({
    isGlobal: true,
    connection: {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      ...process.env.TEMPORAL_TLS === 'true' ? {tls: true} : {},
      ...process.env.TEMPORAL_API_KEY ? {apiKey: process.env.TEMPORAL_API_KEY} : {},
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    },
    taskQueue: 'main',
    logLevel: 'error',
    ...(isWorkers
      ? {
          workers: [
            { identifier: 'main', maxConcurrentJob: undefined },
            ...socialIntegrationList,
          ]
            .filter((f) => f.identifier.indexOf('-') === -1)
            .map((integration) => {
              // Apply concurrency cap: use the lower of the provider's setting and the cap
              const providerConcurrency = integration.maxConcurrentJob;
              const effectiveConcurrency = providerConcurrency
                ? Math.min(providerConcurrency, concurrencyCap)
                : undefined;

              return {
                taskQueue: integration.identifier.split('-')[0],
                workflowsPath: path!,
                activityClasses: activityClasses!,
                autoStart: true,
                ...(effectiveConcurrency
                  ? {
                      workerOptions: {
                        maxConcurrentActivityTaskExecutions: effectiveConcurrency,
                      },
                    }
                  : {}),
              };
            }),
        }
      : {}),
  });
};
