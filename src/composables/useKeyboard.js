import { ref } from 'vue'

export function useKeyboard({ bookmarks, selectedIds, toggleSelect, lightbox, closeLightbox, modals }) {
  const focusedIndex = ref(-1)

  function handleKeydown(e) {
    // Lightbox shortcuts
    if (lightbox.visible) {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft' && lightbox.index > 0) lightbox.index--
      if (e.key === 'ArrowRight' && lightbox.index < lightbox.items.length - 1) lightbox.index++
      return
    }

    // Don't trigger in inputs
    const tag = e.target.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (e.key === 'Escape') e.target.blur()
      return
    }

    // Close modals
    if (e.key === 'Escape') {
      for (const modal of modals) {
        if (modal.value) { modal.value = false; return }
      }
    }

    // Focus search
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      document.querySelector('.search-box input')?.focus()
      return
    }

    // Navigate with j/k
    if (e.key === 'j') {
      focusedIndex.value = Math.min(focusedIndex.value + 1, bookmarks.value.length - 1)
      scrollToFocused()
      return
    }
    if (e.key === 'k') {
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
      scrollToFocused()
      return
    }

    // Toggle selection
    if (e.key === 'x' && focusedIndex.value >= 0 && focusedIndex.value < bookmarks.value.length) {
      toggleSelect(bookmarks.value[focusedIndex.value].id)
      return
    }

    // Open on X
    if (e.key === 'o' && focusedIndex.value >= 0 && focusedIndex.value < bookmarks.value.length) {
      window.open(bookmarks.value[focusedIndex.value].tweetUrl, '_blank')
      return
    }
  }

  function scrollToFocused() {
    const items = document.querySelectorAll('.bookmark-item')
    if (items[focusedIndex.value]) {
      items[focusedIndex.value].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      items.forEach(el => el.classList.remove('focused'))
      items[focusedIndex.value].classList.add('focused')
    }
  }

  return { focusedIndex, handleKeydown }
}
