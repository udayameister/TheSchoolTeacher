'use client';
import { Printer } from 'lucide-react';

export default function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn-ghost" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />{label}</button>;
}
