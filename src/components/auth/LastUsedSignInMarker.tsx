import { cloneElement, isValidElement, type ReactElement } from 'react';
import { lastSignInMethodCaption, type SignInMethod } from '@/lib/lastSignInMethod';
import { cn } from '@/lib/utils';

type ControlProps = {
  className?: string;
  'data-last-used'?: string;
};

/**
 * Adds side brand borders and a soft side glow to the existing control.
 * Other classes on that control stay as they are.
 */
export function LastUsedSignInControl({
  active,
  children,
}: {
  active: boolean;
  children: ReactElement<ControlProps>;
}) {
  if (!isValidElement(children)) return children;

  const control = cloneElement(children, {
    className: cn(children.props.className, active && 'last-used-sign-in'),
    'data-last-used': active ? 'true' : undefined,
  });

  if (!active) return control;

  return <div className="last-used-sign-in-glow relative w-full">{control}</div>;
}

export function LastUsedSignInCaption({
  method,
  id,
}: {
  method: SignInMethod;
  id?: string;
}) {
  return (
    <p id={id} className="text-center text-sm text-primary" data-testid="last-used-sign-in-caption">
      {lastSignInMethodCaption(method)}
    </p>
  );
}
