import { Suspense } from 'react';
import DeliveryTrackingContent from './_components/DeliveryTrackingContent';

export default async function DeliveryOrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Chargement…</div>}>
      <DeliveryTrackingContent orderId={orderId} />
    </Suspense>
  );
}
