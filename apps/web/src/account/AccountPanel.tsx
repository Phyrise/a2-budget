/**
 * Réglages › Compte (V5), compact : qui est connecté (et l'état de la
 * synchronisation), ou « invité », et le bouton qui change de mode. Rien
 * sans configuration Firebase.
 *
 * Se déconnecter, quand ce téléphone a une copie commune : on choisit ce
 * qui reste sur le téléphone (la copie commune, ou ses données d'avant).
 */
import './account.css';
import { useState } from 'react';
import { Button, Companion } from '../ui';
import { useAccount } from './AccountContext';
import { HOUSEHOLD_TEXT, NOTICE_TEXT, ROLE_TEXT, SYNC_STATUS_TEXT } from './accountText';
import { useSync } from './SyncContext';

function LeaveChoice({ onCancel }: { onCancel: () => void }) {
  const { signOut } = useSync();
  return (
    <div className="account__leave" role="group" aria-labelledby="account-leave-title">
      <p id="account-leave-title" className="account__leave-title">
        Garder sur ce téléphone :
      </p>
      <div className="account__leave-actions">
        <Button variant="quiet" size="sm" icon="users" onClick={() => signOut('shared')}>
          La copie commune
        </Button>
        <Button variant="quiet" size="sm" icon="user" onClick={() => signOut('local')}>
          Mes données d’avant
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

export function AccountPanel() {
  const { phase, member, household, notice, signIn, prepareSignIn, continueAsGuest } = useAccount();
  const { mode, status, hasSharedCopy } = useSync();
  const [leaving, setLeaving] = useState(false);
  const leave = () => (mode === 'sync' && hasSharedCopy ? setLeaving(true) : continueAsGuest());

  if (leaving && mode === 'sync') return <LeaveChoice onCancel={() => setLeaving(false)} />;

  if (member !== null) {
    return (
      <div className="account">
        <div className="account__who">
          <Companion who={member.role} size={36} mood="happy" />
          <div className="account__text">
            <p className="account__name">{ROLE_TEXT[member.role]}</p>
            <p className="account__email">{member.email}</p>
            <p className="account__status">
              {mode === 'sync' && status !== null ? SYNC_STATUS_TEXT[status] : HOUSEHOLD_TEXT[household]}
            </p>
          </div>
        </div>
        <Button variant="quiet" size="sm" icon="close" onClick={leave}>
          Se déconnecter
        </Button>
      </div>
    );
  }

  if (phase === 'restoring') {
    return (
      <div className="account">
        <p className="account__name">Reconnexion…</p>
        <Button variant="quiet" size="sm" onClick={leave}>
          Passer en invité
        </Button>
      </div>
    );
  }

  const connecting = phase === 'connecting';
  return (
    <div className="account">
      <div className="account__text">
        <p className="account__name">Invité</p>
        <p className="account__email">Tout reste sur ce téléphone.</p>
        {notice !== null && (
          <p className="account__notice" role="status">
            {NOTICE_TEXT[notice]}
          </p>
        )}
      </div>
      <Button
        variant="quiet"
        size="sm"
        icon="user"
        onPointerDown={prepareSignIn}
        onClick={signIn}
        disabled={connecting}
        aria-busy={connecting}
      >
        {connecting ? 'Connexion…' : 'Se connecter avec Google'}
      </Button>
    </div>
  );
}
