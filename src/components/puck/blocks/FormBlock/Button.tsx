import { ReactNode, ButtonHTMLAttributes } from 'react';
import styles from './styles.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  children,
  className,
  ...props
}: ButtonProps) {
  const variantClass = variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary;
  const combinedClassName = `${styles.button} ${variantClass} ${className || ''}`.trim();

  return (
    <button className={combinedClassName} {...props}>
      {children}
    </button>
  );
}
