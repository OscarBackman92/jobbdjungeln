import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Field, Input } from './input';

describe('Field', () => {
  it('binds the label to its own control', async () => {
    render(<Field label="Arbetsgivare">{(props) => <Input {...props} />}</Field>);

    const input = screen.getByLabelText('Arbetsgivare');
    await userEvent.type(input, 'Acme AB');
    expect(input).toHaveValue('Acme AB');
  });

  it('keeps the required marker out of the accessible name', () => {
    render(
      <Field label="Lösenord" required>
        {(props) => <Input {...props} required />}
      </Field>,
    );

    // "Lösenord *" would be read aloud as "Lösenord star".
    expect(screen.getByLabelText('Lösenord')).toBeRequired();
    expect(screen.queryByLabelText('Lösenord *')).toBeNull();
  });

  it('points the control at its error text so it is announced', () => {
    render(
      <Field label="E-post" error="Adressen ser inte ut att stämma.">
        {(props) => <Input {...props} />}
      </Field>,
    );

    const input = screen.getByLabelText('E-post');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent(
      'Adressen ser inte ut att stämma.',
    );
  });

  it('shows the hint when there is no error, and the error instead when there is', () => {
    const { rerender } = render(
      <Field label="Lösenord" hint="Minst 10 tecken.">
        {(props) => <Input {...props} />}
      </Field>,
    );
    expect(screen.getByText('Minst 10 tecken.')).toBeVisible();

    rerender(
      <Field label="Lösenord" hint="Minst 10 tecken." error="För kort.">
        {(props) => <Input {...props} />}
      </Field>,
    );
    expect(screen.getByText('För kort.')).toBeVisible();
    expect(screen.queryByText('Minst 10 tecken.')).toBeNull();
  });

  it('gives every field its own id, so two on one page do not collide', () => {
    render(
      <>
        <Field label="Från">{(props) => <Input {...props} />}</Field>
        <Field label="Till">{(props) => <Input {...props} />}</Field>
      </>,
    );

    expect(screen.getByLabelText('Från').id).not.toBe(screen.getByLabelText('Till').id);
  });
});
