import { state, api } from './app.js';
import { t, toast, closePanels, escapeHtml } from './ui.js';

let currentOsmId = null;
let currentRating = 0;

function stars(n) {
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

export async function openReviews(osmId, name) {
  currentOsmId = osmId;
  closePanels();
  document.getElementById('reviews-title').textContent = name || t('reviews');
  document.getElementById('modal-reviews').hidden = false;
  await loadReviews();
}

function closeReviews() {
  document.getElementById('modal-reviews').hidden = true;
}

async function loadReviews() {
  let data;
  try {
    data = await api(`/reviews/${encodeURIComponent(currentOsmId)}`);
  } catch (error) {
    toast(error.message);
    return;
  }

  const summary = document.getElementById('reviews-summary');
  summary.innerHTML = data.average != null
    ? `<span class="reviews-avg">${data.average.toFixed(1)}</span>
       <span class="reviews-stars">${stars(Math.round(data.average))}</span>
       <span class="muted">${data.count} ${t('reviews_count')}</span>`
    : `<span class="muted">${t('no_reviews')}</span>`;

  const form = document.getElementById('form-review');
  const hint = document.getElementById('reviews-login-hint');
  if (state.user) {
    form.hidden = false;
    hint.hidden = true;
    const mine = data.reviews.find((r) => r.is_mine);
    setRating(mine ? mine.rating : 0);
    document.getElementById('review-comment').value = mine?.comment || '';
  } else {
    form.hidden = true;
    hint.hidden = false;
  }

  renderList(data.reviews);
}

function renderList(reviews) {
  const list = document.getElementById('reviews-list');
  list.innerHTML = '';
  for (const review of reviews) {
    const date = new Date(review.created_at).toLocaleDateString();
    const li = document.createElement('li');
    li.className = 'review-item';
    li.innerHTML = `
      <div class="review-head">
        <span class="review-author">${escapeHtml(review.username)}${review.is_mine ? ` (${t('you')})` : ''}</span>
        <span class="review-stars">${stars(review.rating)}</span>
      </div>
      ${review.comment ? `<div class="review-text">${escapeHtml(review.comment)}</div>` : ''}
      <div class="review-meta">
        <span class="muted">${date}</span>
        ${review.is_mine ? `<button class="review-delete">${t('delete')}</button>` : ''}
      </div>
    `;
    const del = li.querySelector('.review-delete');
    if (del) del.addEventListener('click', deleteMyReview);
    list.appendChild(li);
  }
}

function setRating(value) {
  currentRating = value;
  document.querySelectorAll('#stars-input button').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.value) <= value);
  });
}

async function submitReview(event) {
  event.preventDefault();
  if (!currentRating) {
    toast(t('select_rating'));
    return;
  }
  const comment = document.getElementById('review-comment').value.trim();
  try {
    await api(`/reviews/${encodeURIComponent(currentOsmId)}`, {
      method: 'POST',
      body: { rating: currentRating, comment: comment || null },
    });
    toast(t('review_saved'));
    await loadReviews();
  } catch (error) {
    toast(error.message);
  }
}

async function deleteMyReview() {
  try {
    await api(`/reviews/${encodeURIComponent(currentOsmId)}`, { method: 'DELETE' });
    toast(t('review_deleted'));
    await loadReviews();
  } catch (error) {
    toast(error.message);
  }
}

export function initReviews() {
  document.querySelector('.reviews-close').addEventListener('click', closeReviews);
  document.getElementById('modal-reviews').addEventListener('click', (event) => {
    if (event.target.id === 'modal-reviews') closeReviews();
  });
  document.getElementById('stars-input').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-value]');
    if (btn) setRating(Number(btn.dataset.value));
  });
  document.getElementById('form-review').addEventListener('submit', submitReview);
}
