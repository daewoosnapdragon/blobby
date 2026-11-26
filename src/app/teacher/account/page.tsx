import type { Metadata } from 'next';
import { requireTeacherUser } from '@/lib/supabase/server';
import { changePassword, saveTeacherName, signOut } from '../actions';
import { TeacherShell } from '../views';
import { AccountView } from './AccountView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const me = await requireTeacherUser();
  const { saved, error } = await searchParams;
  return (
    <TeacherShell signOut={signOut} current="account" who={me.name ?? me.email}>
      <AccountView email={me.email} name={me.name} saved={saved} error={error} saveName={saveTeacherName} savePassword={changePassword} />
    </TeacherShell>
  );
}
