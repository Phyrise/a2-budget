import jiji from '../assets/jiji-avatar-small.png';
import calcifer from '../assets/calcifer-avatar-small.png';

/** Les noms restent explicites ; les compagnons sont décoratifs. */
export function PersonDot({ name, tone }: { name: string; tone: 'a' | 'b' }) {
  return (
    <span className={`person-dot person-dot--${tone}`} aria-hidden="true" title={name}>
      <img src={tone === 'a' ? jiji : calcifer} alt="" draggable={false} />
    </span>
  );
}
