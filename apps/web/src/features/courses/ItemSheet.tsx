/**
 * Feuille d'édition d'un article : libellé, quantité, rayon, retrait.
 * Rayon choisi à la main : le store le mémorise pour ce libellé (V4) — les
 * prochains ajouts du même article iront dans ce rayon. On le dit, sous le
 * choix puis dans un toast : « Je m'en souviendrai pour les prochaines fois ».
 */
import { GROCERY_CATEGORIES, categorizeGrocery, groceryCategoryLabel, type GroceryCategory, type GroceryItem } from '@a2/core';
import { useEffect, useState } from 'react';
import { useApp } from '../../state/store';
import { Button, Sheet, TextField, fr, useToast } from '../../ui';

const REMEMBER = 'Je m’en souviendrai pour les prochaines fois.';

export function ItemSheet({
  item,
  onClose,
  onRemove,
}: {
  item: GroceryItem | null;
  onClose: () => void;
  onRemove: (item: GroceryItem) => void;
}) {
  const { updateGrocery } = useApp();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState<GroceryCategory | ''>('');
  const [initialCategory, setInitialCategory] = useState<GroceryCategory | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item === null) return;
    const chosen = item.category && item.category !== categorizeGrocery(item.label) ? item.category : '';
    setLabel(item.label);
    setQuantity(item.quantity ?? '');
    setCategory(chosen);
    setInitialCategory(chosen);
    setError(null);
  }, [item]);

  // Un rayon choisi à la main (et changé) sera retenu pour ce libellé.
  const remembers = category !== '' && category !== initialCategory;
  const forgets = category === '' && initialCategory !== '';

  const save = () => {
    if (item === null) return;
    if (label.trim() === '') {
      setError('Le nom de l’article ne peut pas être vide.');
      return;
    }
    updateGrocery(item.id, {
      label,
      quantity: quantity.trim() === '' ? null : quantity,
      category: category === '' ? null : category,
    });
    if (remembers) {
      toast.show({ message: fr(`${label.trim()} : rayon ${groceryCategoryLabel(category)}. ${REMEMBER}`), icon: 'check' });
    }
    onClose();
  };

  const autoLabel = groceryCategoryLabel(categorizeGrocery(label || item?.label || ''));

  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      title="Modifier l’article"
      size="auto"
      className="item-sheet"
      footer={
        <>
          <Button
            variant="danger-ghost"
            icon="trash"
            className="task-sheet__delete"
            onClick={() => {
              if (item) onRemove(item);
              onClose();
            }}
          >
            Retirer
          </Button>
          <Button variant="primary" icon="check" onClick={save}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        className="task-form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <TextField
          id="item-label"
          label="Article"
          value={label}
          onChange={(v) => {
            setLabel(v);
            if (error) setError(null);
          }}
          maxLength={120}
          error={error}
          enterKeyHint="done"
        />
        <TextField id="item-quantity" label="Quantité" value={quantity} onChange={setQuantity} placeholder="Ex. ×2, 500 g, 1 paquet" maxLength={40} hint="Facultatif" />
        <div className="field">
          <label className="field__label" htmlFor="item-category">
            Rayon
          </label>
          <select
            id="item-category"
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value as GroceryCategory | '')}
            aria-describedby="item-category-hint"
          >
            <option value="">Automatique ({autoLabel})</option>
            {GROCERY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <p id="item-category-hint" className="field__hint item-sheet__memory" aria-live="polite">
            {remembers ? REMEMBER : forgets ? 'Retour au rayon automatique pour cet article.' : ''}
          </p>
        </div>
      </form>
    </Sheet>
  );
}
