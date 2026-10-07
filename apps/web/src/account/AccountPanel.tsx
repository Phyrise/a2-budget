/**
 * Réglages › Compte (V5), compact : qui est connecté, ou « invité », et le
 * bouton qui change de mode. Rien sans configuration Firebase.
 */
import './account.css';
import { Button, Companion } from '../ui';
import { useAccount } from './AccountContext';
import { HOUSEHOLD_TEXT, NOTICE_TEXT, ROLE_TEXT } from './accountText';

export function AccountPanel() {
  const { phase, member, household, notice, signIn, prepareSignIn, continueAsGuest } = useAccount();

  if (member !== null) {
    return (
      <div className="account">
        <div className="account__who">
          <Companion who={member.role} size={36} mood="happy" />
          <div className="account__text">
            <p className="account__name">{ROLE_TEXT[member.role]}</p>
            <p className="account__email">{member.email}</p>
            <p className="account__status">{HOUSEHOLD_TEXT[household]}</p>
          </div>
        </div>
        <Button variant="quiet" size="sm" icon="close" onClick={continueAsGuest}>
          Se déconnecter
        </Button>
      </div>
    );
  }

  if (phase === 'restoring') {
    return (
      <div className="account">
        <p className="account__name">Reconnexion…</p>
        <Button variant="quiet" size="sm" onClick={continueAsGuest}>
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
