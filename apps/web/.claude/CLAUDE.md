# Termify Web App - UI Guidelines

> Reglas de consistencia visual para el frontend de Termify.
> **IMPORTANTE**: Seguir estas reglas en TODOS los componentes y páginas.

---

## REGLA PRINCIPAL - Página de Referencia

**LA PÁGINA `/terminals` (Dashboard) ES LA REFERENCIA DE DISEÑO.**

Antes de crear o modificar cualquier página del sidebar, SIEMPRE revisar `/terminals` y copiar:
- Estructura del layout
- Espaciados (padding, margins)
- Posición del header y botones
- Estilo de botones de acción
- Estructura del contenido vacío (empty state)

**Checklist obligatorio para nuevas páginas:**
- [ ] ¿El header tiene el mismo estilo que `/terminals`?
- [ ] ¿El botón de acción principal está en la misma posición (derecha del header)?
- [ ] ¿Los espaciados son idénticos?
- [ ] ¿El empty state sigue el mismo patrón?

**SI UNA PÁGINA NO SE VE IGUAL QUE `/terminals`, ESTÁ MAL.**

---

## Layout de Páginas

### Componente PageLayout

**SIEMPRE** usar `PageLayout`, `PageHeader` y `PageContent` de `@/components/ui/page-layout` para todas las páginas del dashboard.

```tsx
import { PageLayout, PageHeader, PageContent } from '@/components/ui/page-layout';

export default function MyPage() {
  return (
    <PageLayout>
      <PageHeader
        title="Page Title"
        description="Optional description"
        actions={<Button>Action</Button>}
      />
      <PageContent>
        {/* Page content here */}
      </PageContent>
    </PageLayout>
  );
}
```

### Anchos Máximos

| Valor | Clase | Uso |
|-------|-------|-----|
| `full` | Sin límite | **DEFAULT** - Listas, tablas, dashboards (como /terminals) |
| `sm` | `max-w-2xl` | Formularios simples |
| `md` | `max-w-4xl` | Settings, formularios medianos |
| `lg` | `max-w-6xl` | Contenido con límite moderado |
| `xl` | `max-w-7xl` | Contenido muy ancho |

**IMPORTANTE**: Por defecto, todas las páginas ocupan el 100% del ancho disponible, igual que `/terminals`.

### Espaciado Consistente

- **Padding de página**: `p-8` (32px)
- **Margen del header**: `mb-8` (32px)
- **Espaciado entre secciones**: `space-y-6` (24px)

---

## Tipografía de Headers

### Títulos de Página

```tsx
// Título principal - SIEMPRE text-3xl
<h1 className="text-3xl font-bold">Page Title</h1>

// Descripción - SIEMPRE text-muted-foreground mt-1
<p className="text-muted-foreground mt-1">Description here</p>
```

### NO usar:
- `text-2xl` para títulos de página (muy pequeño)
- `text-lg` para títulos de página (muy pequeño)
- Iconos junto al título de página

---

## Botones

### Tamaño Estándar

**TODOS** los botones deben usar el componente `Button` de `@/components/ui/button` con tamaño consistente.

```tsx
import { Button } from '@/components/ui/button';

// Botón principal de acción (default) - Alto contraste
<Button>Primary Action</Button>

// Botón primario con color de tema
<Button variant="primary">Theme Primary</Button>

// Botón secundario
<Button variant="outline">Secondary</Button>

// Botón destructivo
<Button variant="destructive">Delete</Button>

// Botón ghost (para toolbars)
<Button variant="ghost" size="icon">
  <Icon className="h-4 w-4" />
</Button>
```

### Variantes de Button

| Variante | Estilo | Uso |
|----------|--------|-----|
| `default` | `bg-foreground text-background` | **Principal** - Acciones principales como "New Terminal", "New Team" |
| `primary` | `bg-primary text-primary-foreground` | Acciones con color de tema |
| `outline` | Borde con fondo transparente | Acciones secundarias |
| `destructive` | Rojo | Eliminar, cancelar |
| `ghost` | Sin fondo | Toolbars, iconos |

### Tamaños Permitidos

| Size | Uso |
|------|-----|
| `default` | **Siempre usar este** para acciones principales |
| `sm` | Solo en tablas o listas compactas |
| `icon` | Solo para botones de icono en toolbars |

### Con Iconos

```tsx
// Icono + texto - gap-2
<Button className="gap-2">
  <Plus size={16} />
  Create Item
</Button>
```

### NO hacer:
- Crear botones con `<button>` y clases custom
- Usar diferentes tamaños en la misma página
- Usar diferentes estilos para acciones similares

---

## Modales

### ⚠️ REGLA CRÍTICA: SIEMPRE usar createPortal

**TODOS los modales DEBEN usar `createPortal` para renderizarse en `document.body`.**

Sin esto, el modal se centra relativo al contenedor padre (ej: el dashboard con sidebar), NO a la ventana, causando que aparezca descentrado.

### Estructura CORRECTA de Modal

```tsx
import { createPortal } from 'react-dom';

// En el componente:
if (!open || typeof document === 'undefined') return null;

return createPortal(
  <>
    {/* Backdrop */}
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    />

    {/* Modal container - centrado */}
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
      <div
        className="relative bg-background border rounded-lg shadow-xl w-full max-w-md pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal content */}
      </div>
    </div>
  </>,
  document.body
);
```

### Checklist OBLIGATORIO para modales

- [ ] Importar `createPortal` de `react-dom`
- [ ] Verificar `typeof document === 'undefined'` antes de renderizar
- [ ] Usar `createPortal(..., document.body)` para renderizar
- [ ] Backdrop con `z-[100]`
- [ ] Container con `z-[101]` y `pointer-events-none`
- [ ] Modal interno con `pointer-events-auto`

### Z-Index para modales

| Elemento | Z-Index | Uso |
|----------|---------|-----|
| Modal backdrop | `z-[100]` | Fondo oscuro |
| Modal container | `z-[101]` | Contenedor flex centrado |
| Modal anidado backdrop | `z-[110]` | Confirmaciones dentro de modales |
| Modal anidado container | `z-[111]` | Diálogos de confirmación |

### ❌ NUNCA hacer esto (causa modales descentrados)

```tsx
// MAL - Sin createPortal
return (
  <>
    <div className="fixed inset-0 z-50 bg-black/60" />
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Modal descentrado! */}
    </div>
  </>
);
```

### Anchos de Modal

| Contenido | max-width |
|-----------|-----------|
| Formulario simple | `max-w-md` |
| Formulario mediano | `max-w-lg` |
| Contenido amplio | `max-w-2xl` |

---

## Cards

Usar siempre los componentes de `@/components/ui/card`:

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

---

## Colores

### Usar SIEMPRE variables de tema

| Variable | Uso |
|----------|-----|
| `text-foreground` | Texto principal |
| `text-muted-foreground` | Texto secundario, descripciones |
| `bg-background` | Fondo principal |
| `bg-card` | Fondo de cards |
| `bg-muted` | Fondo de hover, estados |
| `bg-primary` | Acciones primarias |
| `text-primary` | Acentos, links |
| `text-destructive` | Errores, eliminación |

### NO usar:
- Colores hardcodeados (`#fff`, `rgb()`, etc.)
- Clases de color de Tailwind directas (`text-gray-500`)

---

## Checklist Pre-Commit UI

Antes de hacer commit de cambios de UI:

- [ ] Usa `PageLayout` para páginas del dashboard
- [ ] Headers con `text-3xl font-bold`
- [ ] Botones con componente `Button`
- [ ] **Modales usan `createPortal` a `document.body`** (CRÍTICO)
- [ ] Modales con backdrop blur y animación
- [ ] Colores usando variables de tema
- [ ] Espaciado consistente (`p-8`, `mb-8`, `space-y-6`)
- [ ] Sin iconos en títulos de página

---

## Estructura de Referencia: /terminals

La página `/terminals` es el modelo a seguir. Su estructura es:

```
┌─────────────────────────────────────────────────────────────┐
│  Title (text-3xl)              [Toolbar btns] [+ New Item]  │
│  Description (muted)                                        │
├─────────────────────────────────────────────────────────────┤
│  [Search input] (opcional)                                  │
├─────────────────────────────────────────────────────────────┤
│  [Filters/Tabs] (opcional)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     Content Area                            │
│         (Cards, Lists, Empty State, etc.)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Elementos clave:
1. **Header row**: Título a la izquierda, botón de acción principal a la derecha
2. **Botón de acción**: Siempre `<Button className="gap-2"><Plus size={16} />New X</Button>`
3. **Padding**: `p-8` en todo el contenedor
4. **Margin header**: `mb-8` después del header
5. **Empty state**: Icono centrado + texto + descripción (sin botón duplicado)

---

## Ejemplos de Páginas Correctas

### Página Estándar (como /terminals, /teams, /api-keys)

```tsx
export default function MyPage() {
  return (
    <PageLayout>
      <PageHeader
        title="My Items"
        description="Manage your items"
        actions={
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            New Item
          </Button>
        }
      />
      <PageContent>
        {/* Search bar (opcional) */}
        {/* Filters/tabs (opcional) */}
        {/* Lista de items o empty state */}
        <ItemsList items={items} />
      </PageContent>
      <CreateItemModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </PageLayout>
  );
}
```

### Empty State Correcto

```tsx
// El empty state NO debe tener botón - el botón ya está en el header
<div className="flex flex-col items-center justify-center py-16 px-4">
  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
    <Icon className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-semibold mb-1">No items yet</h3>
  <p className="text-sm text-muted-foreground text-center">
    Create an item to get started.
  </p>
</div>
```

### Página con Settings (como /settings)

```tsx
export default function SettingsPage() {
  return (
    <PageLayout maxWidth="md">
      <PageHeader
        title="Settings"
        description="Manage your preferences"
      />
      <PageContent className="space-y-6">
        <Card>...</Card>
        <Card>...</Card>
      </PageContent>
    </PageLayout>
  );
}
```

---

## Context Menu en Espacio en Blanco (OBLIGATORIO)

**REGLA: Todas las páginas del dashboard con acción de crear deben tener context menu al hacer clic derecho en espacio en blanco.**

| Página | Acción del Context Menu |
|--------|------------------------|
| `/terminals` | New Terminal |
| `/servers` | New Server |
| `/workspaces` | New Workspace |
| `/tasks` | New Task |
| `/teams` | New Team |

### Componente Reutilizable

Usar `BlankAreaContextMenu` de `@/components/ui/BlankAreaContextMenu`:

```tsx
import { BlankAreaContextMenu } from '@/components/ui/BlankAreaContextMenu';

// Estado
const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

// Handler - añadir al contenedor principal
const handleContextMenu = (e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  // No mostrar si el clic fue en elementos interactivos
  if (target.closest('button, a, input, [role="button"], [data-no-context-menu]')) {
    return;
  }
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY });
};

// JSX
<PageContent>
  <div onContextMenu={handleContextMenu}>
    {/* Contenido de la página */}
  </div>
</PageContent>

{/* Renderizar el context menu */}
{contextMenu && (
  <BlankAreaContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    onClose={() => setContextMenu(null)}
    onAction={() => setCreateModalOpen(true)}
    actionLabel="New Item"  // Cambiar según la página
  />
)}
```

### Checklist para nuevas páginas

- [ ] Importar `BlankAreaContextMenu`
- [ ] Agregar estado `contextMenu`
- [ ] Agregar handler `handleContextMenu`
- [ ] Agregar `onContextMenu` al contenedor del contenido
- [ ] Renderizar `BlankAreaContextMenu` con la acción correspondiente

### Páginas ya implementadas

- [x] `/terminals` - "New Terminal"
- [x] `/servers` - "New Server"
- [x] `/workspaces` - "New Workspace"
- [x] `/tasks` - "New Task"
- [x] `/teams` - "New Team"
