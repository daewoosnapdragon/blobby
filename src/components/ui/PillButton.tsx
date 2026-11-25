import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowIcon } from './icons';
import styles from './ui.module.css';

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** lg: full-width screen action (44px arrow); md: card action (36px); sm: feedback card (34px) */
  size?: 'lg' | 'md' | 'sm';
  /** background of the arrow circle; yellow by default (pick shows the chosen blob color) */
  arrowColor?: string;
  ref?: React.Ref<HTMLButtonElement & HTMLAnchorElement>;
};

/** The main action: a black pill with a yellow arrow circle (spec 5.10). A link when given href. */
export function PillButton({ children, href, onClick, type = 'button', disabled, size = 'lg', arrowColor, ref }: Props) {
  const cls = `${styles.pill} ${styles[size]}`;
  const icon = { lg: 20, md: 18, sm: 16 }[size];
  const inner = (
    <>
      <span>{children}</span>
      <span className={styles.arrow} style={arrowColor ? { background: arrowColor } : undefined} aria-hidden="true">
        <ArrowIcon size={icon} />
      </span>
    </>
  );
  if (href) {
    return <Link href={href} className={cls} ref={ref}>{inner}</Link>;
  }
  return <button type={type} className={cls} onClick={onClick} disabled={disabled} ref={ref}>{inner}</button>;
}
