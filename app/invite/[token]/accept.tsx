"use client";
import { useTransition } from "react";
import { acceptInvitation } from "@/app/actions";
import { Button } from "@/components/ui";
export function AcceptButton({ token, label }: { token: string; label: string }) {
  const [pending, start] = useTransition();
  return <Button size="lg" disabled={pending} onClick={() => start(async () => { await acceptInvitation(token); })}>{label}</Button>;
}
