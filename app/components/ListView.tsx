'use client';

import CardListRow from './CardListRow';
import { CardEntry, ListType } from './CardTypes';
import CardListGrid from './CardListGrid';

interface ListViewProps {
  cards: CardEntry[];
  activeTab: ListType;

  selectedCards: Set<string>;

  toggleSelect: (id: string) => void;

  removeCard: (
    tab: ListType,
    id: string
  ) => void;

  updateQty: (
    tab: ListType,
    id: string,
    value: string
  ) => void;

  updatePrice: (
    tab: ListType,
    id: string,
    value: string
  ) => void;

  handleFindSingle: (
    card: CardEntry
  ) => void;

  handleImageMouseEnter: (
    e: React.MouseEvent<HTMLImageElement>,
    card: CardEntry
  ) => void;

  handleImageMouseLeave: () => void;

  requestMarkSold?: (card: CardEntry) => void;

  viewMode: 'grid' | 'list';

  /** When true, renders cards in read-only mode (viewing another user's lists) */
  readOnly?: boolean;
}

export default function ListView({
  cards,
  activeTab,
  selectedCards,
  toggleSelect,
  removeCard,
  updateQty,
  updatePrice,
  handleFindSingle,
  handleImageMouseEnter,
  handleImageMouseLeave,
  requestMarkSold,
  viewMode,
  readOnly = false,
}: ListViewProps) {
  if (!cards.length) {
    return (
      <div className="ca-listview-empty">
        No cards found.
      </div>
    );
  }

return viewMode === 'grid' ? (
    <div className="ca-listview-grid">
      {cards.map((card) => (
        <CardListGrid
          key={card.id}
          card={card}
          activeTab={activeTab}
          selected={selectedCards.has(card.id)}
          toggleSelect={toggleSelect}
          removeCard={removeCard}
          updateQty={updateQty}
          updatePrice={updatePrice}
          handleFindSingle={handleFindSingle}
          handleImageMouseEnter={handleImageMouseEnter}
          handleImageMouseLeave={handleImageMouseLeave}
          requestMarkSold={requestMarkSold}
          readOnly={readOnly}
        />
      ))}
    </div>
  ) : (
    <div className="ca-listview-list">
      {cards.map((card) => (
        <CardListRow
          key={card.id}
          card={card}
          activeTab={activeTab}
          selected={selectedCards.has(card.id)}
          toggleSelect={toggleSelect}
          removeCard={removeCard}
          updateQty={updateQty}
          updatePrice={updatePrice}
          handleFindSingle={handleFindSingle}
          handleImageMouseEnter={handleImageMouseEnter}
          handleImageMouseLeave={handleImageMouseLeave}
          requestMarkSold={requestMarkSold}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}