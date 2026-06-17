'use client';

// TEMPORARY diagnostic route — renders the product editor with no auth gate so
// the updated design can be verified directly at /preview-editor?kind=<kind>.
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ProductEditor } from '@/components/stan/ProductEditor';
import { buildInitialProduct } from '@/lib/product-types';

function Inner() {
  const sp = useSearchParams();
  const kind = sp.get('kind') ?? 'digital';
  const tab = (sp.get('tab') as 'thumbnail' | 'checkout' | 'options' | null) ?? 'thumbnail';
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8">
        <ProductEditor initial={buildInitialProduct(kind)} onSaved={() => {}} initialTab={tab} />
      </div>
    </div>
  );
}

export default function PreviewEditorPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
