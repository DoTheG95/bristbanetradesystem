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
  
  viewMode: 'grid' | 'list';
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
  viewMode,
}: ListViewProps) {
  if (!cards.length) {
    return (
      <div
        style={{
          padding: 60,
          textAlign: 'center',
          color: '#888',
        }}
      >
        No cards found.
      </div>
    );
  }

return viewMode === 'grid' ? (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
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
        />
      ))}
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        />
      ))}
    </div>
  );
}