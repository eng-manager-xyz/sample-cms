import { createFileRoute } from '@tanstack/react-router';
import { AdminGateway } from '@/components/admin-gateway';
import { adminGatewayResponseHeaders, adminGatewayRobotsPolicy } from '@/data/admin-gateway-policy';
import { loadAdminGateway } from '@/server-functions/admin-gateway.functions';

export const Route = createFileRoute('/admin')({
  loader: () => loadAdminGateway(),
  head: () => ({
    meta: [
      { title: 'Auteur | Authoring gateway' },
      { name: 'robots', content: adminGatewayRobotsPolicy },
      {
        name: 'description',
        content: 'A private gateway to the separately deployed Auteur CMS authoring application.',
      },
    ],
  }),
  headers: () => adminGatewayResponseHeaders,
  component: AdminGatewayRoute,
});

function AdminGatewayRoute() {
  return <AdminGateway state={Route.useLoaderData()} />;
}
