(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const motionControl = $('motion-control');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionPaused = reducedMotion.matches;

  function makeUuid() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function updateMotionControl() {
    document.body.classList.toggle('motion-paused', motionPaused);
    if (!motionControl) return;
    motionControl.setAttribute('aria-pressed', String(motionPaused));
    motionControl.disabled = reducedMotion.matches;
    motionControl.replaceChildren(document.createTextNode(reducedMotion.matches ? 'Efeitos reduzidos ' : motionPaused ? 'Ativar efeitos ' : 'Pausar efeitos '));
    const symbol = document.createElement('span');
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = motionPaused ? '▷' : 'Ⅱ';
    motionControl.append(symbol);
    if (reducedMotion.matches) {
      motionControl.title = 'Os efeitos acompanham a preferência de movimento reduzido do seu aparelho';
    } else {
      motionControl.removeAttribute('title');
    }
  }

  motionControl?.addEventListener('click', () => {
    if (reducedMotion.matches) return;
    motionPaused = !motionPaused;
    updateMotionControl();
  });
  reducedMotion.addEventListener('change', () => {
    motionPaused = reducedMotion.matches;
    updateMotionControl();
  });
  updateMotionControl();

  function initializeRsvp() {
    const form = $('rsvp-form');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = 'true';
    const maxAttendees = 20;
    const intro = $('rsvp-intro');
    const fields = $('attendee-fields');
    const fieldset = $('attendee-fieldset');
    const yesButton = $('yes-button');
    const noButton = $('no-button');
    const addButton = $('add-attendee');
    const submitButton = $('submit-button');
    const submitLabel = $('submit-label');
    const formError = $('form-error');
    const success = $('success-state');
    const decline = $('decline-state');
    const dialog = $('decline-dialog');
    let fieldSequence = 1;
    let submitting = false;
    let lastPayload = '';
    let idempotencyKey = '';

    function clearError() {
      formError.hidden = true;
      formError.textContent = '';
      fields.querySelectorAll('[aria-invalid]').forEach((input) => {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      });
    }

    function showError(message, input) {
      formError.textContent = message;
      formError.hidden = false;
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', 'form-error');
        input.focus();
      }
    }

    function showForm() {
      intro.hidden = true;
      decline.hidden = true;
      success.hidden = true;
      form.hidden = false;
      yesButton.setAttribute('aria-expanded', 'true');
      clearError();
      requestAnimationFrame(() => {
        if (!form.isConnected) return;
        $('confirmar').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
        // Avoid opening a phone's keyboard before the person is ready to type.
        if (window.matchMedia('(pointer: fine)').matches) {
          fields.querySelector('input').focus({ preventScroll: true });
        } else {
          form.focus({ preventScroll: true });
        }
      });
    }

    yesButton.addEventListener('click', showForm);
    $('change-mind-button').addEventListener('click', showForm);

    function closeDialog() {
      dialog.close();
    }

    noButton.addEventListener('click', () => {
      document.body.classList.add('dialog-open');
      dialog.showModal();
    });
    $('dialog-close').addEventListener('click', closeDialog);
    dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
    });
    $('dialog-yes').addEventListener('click', () => {
      closeDialog();
      showForm();
    });
    $('dialog-no').addEventListener('click', () => {
      closeDialog();
      intro.hidden = true;
      form.hidden = true;
      success.hidden = true;
      decline.hidden = false;
      decline.focus({ preventScroll: true });
    });

    function updateAttendeeControls() {
      const rows = fields.querySelectorAll('.attendee-row');
      const isAtLimit = rows.length >= maxAttendees;
      addButton.disabled = isAtLimit;
      $('attendee-limit').hidden = !isAtLimit;
      rows.forEach((row, index) => {
        if (index === 0) return;
        row.querySelector('label').textContent = `Nome do acompanhante ${index}`;
        row.querySelector('button').setAttribute('aria-label', `Remover acompanhante ${index}`);
      });
    }

    addButton.addEventListener('click', () => {
      if (submitting || fields.children.length >= maxAttendees) return;
      fieldSequence += 1;
      const row = document.createElement('div');
      row.className = 'attendee-row';
      const wrap = document.createElement('div');
      wrap.className = 'attendee-input-wrap';
      const label = document.createElement('label');
      label.htmlFor = `attendee-${fieldSequence}`;
      const input = document.createElement('input');
      input.id = `attendee-${fieldSequence}`;
      input.name = input.id;
      input.type = 'text';
      input.maxLength = 120;
      input.autocomplete = 'off';
      input.setAttribute('autocapitalize', 'words');
      input.setAttribute('enterkeyhint', 'done');
      input.spellcheck = false;
      input.placeholder = 'Nome completo';
      input.required = true;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-attendee';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        if (submitting) return;
        const nextInput = row.previousElementSibling?.querySelector('input');
        row.remove();
        updateAttendeeControls();
        clearError();
        nextInput?.focus();
      });
      wrap.append(label, input);
      row.append(wrap, remove);
      fields.append(row);
      updateAttendeeControls();
      clearError();
      input.focus();
    });

    fields.addEventListener('input', clearError);

    function setSubmitting(value) {
      submitting = value;
      fieldset.disabled = value;
      submitButton.disabled = value;
      submitButton.classList.toggle('is-loading', value);
      form.setAttribute('aria-busy', String(value));
      submitLabel.textContent = value ? 'Confirmando presença' : 'Confirmar minha presença';
      $('form-status').textContent = value ? 'Salvando sua confirmação de presença' : '';
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting) return;
      clearError();
      const inputs = Array.from(fields.querySelectorAll('input'));
      const names = inputs.map((input) => input.value.trim().replace(/\s+/gu, ' '));
      const emptyIndex = names.findIndex((name) => name.length === 0);
      if (emptyIndex !== -1) {
        showError(emptyIndex === 0 ? 'Escreva seu nome para confirmar a presença' : 'Escreva o nome de cada acompanhante ou remova o campo vazio', inputs[emptyIndex]);
        return;
      }
      if (names.some((name) => name.length > 120) || names.length > maxAttendees) {
        showError('Confira os nomes: use até 120 caracteres por pessoa e até 20 pessoas por confirmação');
        return;
      }

      const payload = JSON.stringify(names);
      if (payload !== lastPayload || !idempotencyKey) {
        lastPayload = payload;
        idempotencyKey = makeUuid();
      }
      setSubmitting(true);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ names, idempotencyKey }),
          signal: controller.signal,
        });
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error('A confirmação não retornou uma resposta válida — seus nomes continuam aqui, tente novamente');
        }
        if (!response.ok || result?.ok !== true) {
          const serverMessage = typeof result?.error === 'string' && result.error.length <= 240 ? result.error : '';
          throw new Error(serverMessage?.replace(/\.+$/, '').replace(/\.\s+/g, ' — ') || 'Não foi possível salvar sua presença agora — seus nomes continuam aqui, tente novamente');
        }
        form.hidden = true;
        intro.hidden = true;
        decline.hidden = true;
        success.hidden = false;
        success.focus({ preventScroll: true });
        if (!reducedMotion.matches && !motionPaused) {
          success.classList.add('is-celebrating');
          window.setTimeout(() => success.classList.remove('is-celebrating'), 1800);
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          showError('A conexão demorou — toque em confirmar de novo: sua presença não será duplicada');
        } else if (error instanceof TypeError) {
          showError('Confira sua internet e tente confirmar de novo — seus nomes continuam aqui');
        } else {
          showError(error?.message || 'Não foi possível salvar sua presença. Tente novamente');
        }
      } finally {
        window.clearTimeout(timeout);
        setSubmitting(false);
      }
    });
  }

  document.addEventListener('invitation:navigate', initializeRsvp);
  initializeRsvp();
})();
