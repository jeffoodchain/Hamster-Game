/*
 * shop.js
 *
 * The HTML shop modal: render the grid for the active tab, handle clicks on
 * each item button, and open/close the modal. Not a canvas thing — uses the
 * DOM elements declared in index.html (#shopModal, #shopGrid, the .shopTab
 * buttons).
 *
 * Item buttons have four behaviors depending on what kind they are and
 * whether they're owned:
 *   - treats:    always "Buy & Feed (N💰)" — buying triggers goTreat()
 *                immediately (the hamster walks to the jar and eats it).
 *   - toys:      one-time purchase. Becomes "Owned ✓" afterwards. Buying
 *                the ball flips ball.active so it appears in the cage.
 *   - cosmetics: same one-time purchase, but afterwards the item can be
 *                worn / unworn, swapping save.equipped.
 */

import { SHOP_ITEMS } from './config.js';
import { save, ball } from './state.js';
import { shopBtn, shopModal, closeShop, shopGrid } from './canvas.js';
import { snd } from './audio.js';
import { persist } from './save.js';
import { goTreat } from './behavior.js';
import { updateHud } from './hud.js';
import { onTrigger, checkAll } from './achievements.js';
import { buildBg } from './background.js';
import { bumpStat } from './stats.js';

let activeTab = 'toys';

export function renderShop() {
  shopGrid.innerHTML = '';
  for (const item of SHOP_ITEMS[activeTab]) {
    const card = document.createElement('div');
    card.className = 'shopItem';

    // Themes use a parallel ownership model (save.themesOwned + save.activeTheme),
    // so they branch separately from the toy/cosmetic/treat path.
    const isTheme  = item.type === 'theme';
    const owned = isTheme
      ? save.themesOwned.includes(item.id)
      : (item.type !== 'treat' && save.owned[item.id]);
    const equipped = isTheme
      ? save.activeTheme === item.id
      : (item.type === 'cosmetic' && save.equipped === item.id);
    if (owned)    card.classList.add('owned');
    if (equipped) card.classList.add('equipped');

    // Decide button label + disabled state
    let btnTxt, btnDis = false;
    if (item.type === 'treat') {
      btnTxt = `Buy & Feed (${item.price}💰)`;
      if (save.coins < item.price) btnDis = true;
    } else if (isTheme) {
      // Themes: always-applied semantics (you can't "take off" a theme; you
      // just switch to another). So the active one is read-only here.
      if (equipped) { btnTxt = 'Active ✓'; btnDis = true; }
      else if (owned) { btnTxt = 'Apply'; }
      else { btnTxt = `Buy (${item.price}💰)`; if (save.coins < item.price) btnDis = true; }
    } else if (equipped) {
      btnTxt = 'Take Off';
    } else if (owned) {
      btnTxt = item.type === 'cosmetic' ? 'Wear' : 'Owned ✓';
      if (item.type !== 'cosmetic') btnDis = true;
    } else {
      btnTxt = `Buy (${item.price}💰)`;
      if (save.coins < item.price) btnDis = true;
    }

    card.innerHTML = `
      <div class="emoji">${item.emoji}</div>
      <div class="name">${item.name}</div>
      <div class="desc">${item.desc}</div>`;
    const btn = document.createElement('button');
    btn.textContent = btnTxt;
    btn.disabled = btnDis;
    btn.addEventListener('click', () => onBuy(item, owned, equipped));
    const priceRow = document.createElement('div');
    priceRow.className = 'priceRow';
    priceRow.appendChild(btn);
    card.appendChild(priceRow);
    shopGrid.appendChild(card);
  }
}

function onBuy(item, owned, equipped) {
  // Themes: buy if not owned, then apply. Re-rasterizes the background so
  // the new palette appears immediately. "Active" is a no-op (the button
  // is disabled in that state, but guard anyway).
  if (item.type === 'theme') {
    if (equipped) return;
    if (!owned) {
      if (save.coins < item.price) { snd('reject'); return; }
      save.coins -= item.price;
      if (item.price > 0) bumpStat('coinsSpent', item.price);
      // Defensive: avoid duplicate ids if a tampered save somehow gets here
      // for an item the player technically already owns.
      if (!save.themesOwned.includes(item.id)) save.themesOwned.push(item.id);
    }
    save.activeTheme = item.id;
    buildBg();
    snd('buy');
    persist();
    renderShop();
    updateHud();
    return;
  }

  // Treats: deduct, close shop, then trigger the eat-walk in behavior.js.
  if (item.type === 'treat') {
    if (save.coins < item.price) { snd('reject'); return; }
    save.coins -= item.price;
    if (item.price > 0) bumpStat('coinsSpent', item.price);
    snd('buy');
    closeShopModal();
    goTreat(item.id);
    persist();
    renderShop();
    updateHud();
    return;
  }

  // Cosmetic owned + equipped: clicking takes it off.
  if (equipped) {
    save.equipped = 'none';
    snd('click');
    persist();
    renderShop();
    return;
  }

  // Cosmetic owned but not worn: clicking equips it.
  if (owned) {
    save.equipped = item.id;
    snd('buy');
    persist();
    renderShop();
    onTrigger('equip');
    return;
  }

  // Fresh purchase
  if (save.coins < item.price) { snd('reject'); return; }
  save.coins -= item.price;
  if (item.price > 0) bumpStat('coinsSpent', item.price);
  save.owned[item.id] = true;
  if (item.id === 'ball') {
    // Sync the runtime mirror; resetGame() also does this on screen-change.
    ball.active = true;
  }
  if (item.type === 'cosmetic') save.equipped = item.id;
  snd('buy');
  persist();
  renderShop();
  updateHud();
  // Auto-equipped on purchase, so a fresh cosmetic also fires fashionista.
  if (item.type === 'cosmetic') onTrigger('equip');
  // Picks up ownBall / ownTunnel / ownCrown / allCosmetics.
  checkAll();
}

export function openShopModal(initialTab) {
  if (initialTab) setActiveTab(initialTab);
  renderShop();
  shopModal.classList.add('show');
  snd('click');
}

export function closeShopModal() {
  shopModal.classList.remove('show');
}

function setActiveTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.shopTab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
}

export function initShop() {
  shopBtn.addEventListener('click', () => openShopModal());
  closeShop.addEventListener('click', () => { closeShopModal(); snd('click'); });
  // Click on the modal backdrop (not the box) closes the shop.
  shopModal.addEventListener('click', (e) => {
    if (e.target === shopModal) closeShopModal();
  });
  document.querySelectorAll('.shopTab').forEach((t) => {
    t.addEventListener('click', () => {
      setActiveTab(t.dataset.tab);
      renderShop();
      snd('click');
    });
  });
}
