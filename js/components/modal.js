let backdrop = null;

function escHandler(e) {
  if (e.key === 'Escape') modal.close();
}

export const modal = {
  open({ title, content, actions = [] }) {
    modal.close();

    backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const m = document.createElement('div');
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    const titleEl = document.createElement('h3');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }

    // Actions
    const actionsEl = document.createElement('div');
    actionsEl.className = 'modal-actions';
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = `btn btn-${a.type || 'ghost'}`;
      btn.textContent = a.label;
      btn.addEventListener('click', () => { a.onClick?.(); });
      actionsEl.appendChild(btn);
    });

    m.appendChild(header);
    m.appendChild(body);
    m.appendChild(actionsEl);
    backdrop.appendChild(m);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) modal.close();
    });
    document.addEventListener('keydown', escHandler);
  },

  close() {
    if (backdrop) {
      backdrop.remove();
      backdrop = null;
    }
    document.removeEventListener('keydown', escHandler);
  },

  confirm(message) {
    return new Promise(resolve => {
      modal.open({
        title: 'Confirmar',
        content: `<p>${message}</p>`,
        actions: [
          {
            label: 'Cancelar',
            type: 'ghost',
            onClick: () => { modal.close(); resolve(false); },
          },
          {
            label: 'Confirmar',
            type: 'primary',
            onClick: () => { modal.close(); resolve(true); },
          },
        ],
      });
    });
  },
};
