/** Feuille d'édition d'un article : libellé, quantité, rayon, retrait. */
import { GROCERY_CATEGORIES, categorizeGrocery, groceryCategoryLabel, type GroceryCategory, type GroceryItem } from '@a2/core';
import { useEffect, useState } from 'react';
import { useApp } from '../../state/store';
import { Button, Sheet, TextField } from '../../ui';

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
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState<GroceryCategory | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item === null) return;
    setLabel(item.label);
    setQuantity(item.quantity ?? '');
    setCategory(item.category && item.category !== categorizeGrocery(item.label) ? item.category : '');
    setError(null);
  }, [item]);

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
          <select id="item-category" className="select" value={category} onChange={(e) => setCategory(e.target.value as GroceryCategory | '')}>
            <option value="">Automatique ({autoLabel})</option>
            {GROCERY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Sheet>
  );
}
