<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  Upload, 
  Plus, 
  Trash2, 
  Download, 
  ShoppingCart, 
  Move, 
  Maximize2, 
  RotateCw,
  Info,
  Eraser
} from 'lucide-vue-next'
import interact from 'interactjs'

interface Product {
  id: number
  name: string
  category: string
  price: number
  image_url: string
  width: number
  height: number
}

interface PlacedItem extends Product {
  instanceId: string
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  rotation: number
  zIndex: number
}

const products = ref<Product[]>([])
const searchQuery = ref('')
const placedItems = ref<PlacedItem[]>([])
const roomImage = ref<string | null>(null)
const selectedItemId = ref<string | null>(null)
const nextZIndex = ref(10)

// Modal state for custom item
const showCustomItemModal = ref(false)
const isProcessingImage = ref(false)
const customItemForm = ref<{ name: string, price: number, image_url: string }>({
  name: '',
  price: 0,
  image_url: ''
})

// Fetch products from SQLite
const { data: productsData } = await useFetch<Product[]>('/api/products')
if (productsData.value) {
  products.value = [...productsData.value]
}

const filteredProducts = computed(() => {
  if (!searchQuery.value) return products.value
  const query = searchQuery.value.toLowerCase()
  return products.value.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.category.toLowerCase().includes(query)
  )
})

const totalPrice = computed(() => {
  return placedItems.value.reduce((sum, item) => sum + item.price, 0)
})

const handleImageUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      roomImage.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const removeBackground = async (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image()
    // Set crossOrigin to allow processing images from other domains (like picsum.photos)
    if (!dataUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // Sample top-left pixel as background
        const r = data[0] ?? 255
        const g = data[1] ?? 255
        const b = data[2] ?? 255
        const tolerance = 40

        for (let i = 0; i < data.length; i += 4) {
          const dr = Math.abs((data[i] ?? 0) - r)
          const dg = Math.abs((data[i + 1] ?? 0) - g)
          const db = Math.abs((data[i + 2] ?? 0) - b)

          if (dr < tolerance && dg < tolerance && db < tolerance) {
            data[i + 3] = 0 // Set alpha to 0
          }
        }

        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        console.error('Failed to process image due to CORS or other security error:', e)
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

const handleCustomItemUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const fileName = file.name.split('.')[0] || 'Новый предмет'
    const reader = new FileReader()
    reader.onload = async (e) => {
      isProcessingImage.value = true
      showCustomItemModal.value = true
      
      const originalUrl = (e.target?.result as string) || ''
      const processedUrl = await removeBackground(originalUrl)
      
      customItemForm.value = {
        name: fileName,
        price: 0,
        image_url: processedUrl
      }
      isProcessingImage.value = false
    }
    reader.readAsDataURL(file)
  }
}

const confirmAddCustomItem = async () => {
  const newProductData = {
    name: customItemForm.value.name || 'Новый предмет',
    category: 'Свой',
    price: Number(customItemForm.value.price) || 0,
    image_url: customItemForm.value.image_url,
    width: 150,
    height: 150
  }
  
  try {
    const savedProduct = await $fetch<Product>('/api/products', {
      method: 'POST',
      body: newProductData
    })
    
    // Add to catalog
    products.value.unshift(savedProduct)
    
    // Also add to room immediately
    addProductToRoom(savedProduct)
    
    // Reset and close
    showCustomItemModal.value = false
    customItemForm.value = { name: '', price: 0, image_url: '' }
  } catch (e) {
    console.error('Failed to save product:', e)
  }
}

const addProductToRoom = (product: Product) => {
  const newItem: PlacedItem = {
    ...product,
    instanceId: Math.random().toString(36).substr(2, 9),
    x: 100,
    y: 100,
    displayWidth: product.width,
    displayHeight: product.height,
    rotation: 0,
    zIndex: nextZIndex.value++
  }
  placedItems.value.push(newItem)
  selectedItemId.value = newItem.instanceId
  
  nextTick(() => {
    initInteract(newItem.instanceId)
  })
}

const initInteract = (id: string) => {
  const selector = `[data-item-id="${id}"]`
  
  interact(selector)
    .draggable({
      listeners: {
        move(event) {
          const item = placedItems.value.find(i => i.instanceId === id)
          if (item) {
            item.x += event.dx
            item.y += event.dy
          }
        }
      }
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      listeners: {
        move(event) {
          const item = placedItems.value.find(i => i.instanceId === id)
          if (item) {
            item.displayWidth = event.rect.width
            item.displayHeight = event.rect.height
            item.x += event.deltaRect.left
            item.y += event.deltaRect.top
          }
        }
      }
    })
}

const removeBackgroundFromItem = async (instanceId: string) => {
  const item = placedItems.value.find(i => i.instanceId === instanceId)
  if (item) {
    const processedUrl = await removeBackground(item.image_url)
    item.image_url = processedUrl
  }
}

const removeItem = (id: string) => {
  placedItems.value = placedItems.value.filter(i => i.instanceId !== id)
  if (selectedItemId.value === id) selectedItemId.value = null
}

const bringToFront = (id: string) => {
  const item = placedItems.value.find(i => i.instanceId === id)
  if (item) {
    item.zIndex = nextZIndex.value++
    selectedItemId.value = id
  }
}

const exportEstimate = () => {
  if (placedItems.value.length === 0) return

  let content = "СМЕТА ПРОЕКТА DIGITAL TWIN\n"
  content += "==========================\n\n"
  
  placedItems.value.forEach((item, index) => {
    content += `${index + 1}. ${item.name} (${item.category})\n`
    content += `   Цена: ${item.price.toLocaleString('ru-RU')} ₽\n\n`
  })
  
  content += "--------------------------\n"
  content += `ИТОГО: ${totalPrice.value.toLocaleString('ru-RU')} ₽\n`
  
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `estimate-${new Date().toISOString().split('T')[0]}.txt`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <!-- Header -->
    <header class="h-16 border-b border-black/5 bg-white flex items-center justify-between px-8 z-50">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold">DT</div>
        <h1 class="text-xl font-medium tracking-tight">Digital Twin <span class="text-black/40 font-light">Planner</span></h1>
      </div>
      
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2 px-4 py-2 bg-[#F5F5F0] rounded-full border border-black/5">
          <ShoppingCart class="w-4 h-4 text-black/60" />
          <span class="text-sm font-medium">{{ totalPrice.toLocaleString('ru-RU') }} ₽</span>
        </div>
        <button 
          @click="exportEstimate"
          class="px-5 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-colors flex items-center gap-2 disabled:opacity-50"
          :disabled="placedItems.length === 0"
        >
          <Download class="w-4 h-4" />
          Экспорт сметы
        </button>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <!-- Sidebar: Products -->
      <aside class="w-80 border-r border-black/5 bg-white flex flex-col overflow-hidden">
        <div class="p-6 border-b border-black/5 space-y-4">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-black/40">Каталог товаров</h2>
          
          <label class="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-black/10 rounded-xl cursor-pointer hover:bg-black/5 transition-colors text-black/60 hover:text-black">
            <Plus class="w-4 h-4" />
            <span class="text-xs font-medium">Добавить свой предмет</span>
            <input type="file" class="hidden" @change="handleCustomItemUpload" accept="image/*" />
          </label>

          <div class="relative">
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="Поиск мебели..." 
              class="w-full px-4 py-2 bg-[#F5F5F0] rounded-lg border border-black/5 text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
            />
          </div>
        </div>
        
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div 
            v-for="product in filteredProducts" 
            :key="product.id"
            class="group cursor-pointer"
            @click="addProductToRoom(product)"
          >
            <div class="aspect-square overflow-hidden flex items-center justify-center relative p-4">
              <img :src="product.image_url" :alt="product.name" class="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform drop-shadow-sm" />
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-xl">
                <Plus class="w-6 h-6 text-black/40" />
              </div>
            </div>
            <div class="px-2 py-1 text-center">
              <div class="text-[10px] text-black/30 uppercase tracking-widest mb-0.5">{{ product.category }}</div>
              <div class="text-xs font-medium line-clamp-1">{{ product.name }}</div>
              <div class="text-xs font-bold mt-0.5">{{ product.price.toLocaleString('ru-RU') }} ₽</div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Canvas Area -->
      <section class="flex-1 bg-[#EBEBE6] relative overflow-hidden flex items-center justify-center p-12">
        <!-- Room Background -->
        <div 
          class="relative bg-white shadow-2xl rounded-lg overflow-hidden transition-all duration-500 max-w-full max-h-full aspect-video flex items-center justify-center border-4 border-white"
          :class="{ 'w-[1000px]': roomImage, 'w-[600px] h-[400px] border-dashed border-black/10 bg-transparent': !roomImage }"
        >
          <img v-if="roomImage" :src="roomImage" class="w-full h-full object-cover pointer-events-none" />
          
          <div v-else class="flex flex-col items-center text-center p-8">
            <div class="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mb-4">
              <Upload class="w-8 h-8 text-black/20" />
            </div>
            <h3 class="text-lg font-medium mb-2">Загрузите фото комнаты</h3>
            <p class="text-sm text-black/40 max-w-xs mb-6">Сфотографируйте ваше пространство, чтобы начать планирование интерьера</p>
            <label class="px-6 py-2.5 bg-black text-white rounded-full text-sm font-medium cursor-pointer hover:bg-black/80 transition-colors">
              Выбрать файл
              <input type="file" class="hidden" @change="handleImageUpload" accept="image/*" />
            </label>
          </div>

          <!-- Placed Items Overlay -->
          <div v-if="roomImage" class="absolute inset-0 overflow-hidden">
            <div 
              v-for="item in placedItems" 
              :key="item.instanceId"
              :data-item-id="item.instanceId"
              class="absolute cursor-move group select-none touch-none"
              :style="{
                left: `${item.x}px`,
                top: `${item.y}px`,
                zIndex: item.zIndex,
                transform: `rotate(${item.rotation}deg)`,
                width: `${item.displayWidth}px`,
                height: `${item.displayHeight}px`
              }"
              @mousedown="bringToFront(item.instanceId)"
            >
              <img :src="item.image_url" class="w-full h-full pointer-events-none drop-shadow-2xl object-fill" />
              
              <!-- Controls (visible on hover or select) -->
              <div 
                class="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white shadow-xl rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity border border-black/5 z-[1000]"
                :class="{ 'opacity-100': selectedItemId === item.instanceId }"
              >
                <button @click.stop="removeItem(item.instanceId)" class="p-1.5 hover:bg-red-50 text-red-500 rounded-full transition-colors" title="Удалить">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
                <div class="w-px h-3 bg-black/10 mx-1"></div>
                <button @click.stop="removeBackgroundFromItem(item.instanceId)" class="p-1.5 hover:bg-black/5 text-black/60 rounded-full transition-colors" title="Удалить фон">
                  <Eraser class="w-3.5 h-3.5" />
                </button>
                <div class="w-px h-3 bg-black/10 mx-1"></div>
                <div class="text-[10px] font-bold px-1 whitespace-nowrap">{{ item.price.toLocaleString('ru-RU') }} ₽</div>
              </div>

              <!-- Resize handles visual -->
              <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-black rounded-full opacity-0 group-hover:opacity-100 cursor-nwse-resize border-2 border-white shadow-lg"></div>
              <div class="absolute -top-1 -left-1 w-4 h-4 bg-black rounded-full opacity-0 group-hover:opacity-100 cursor-nwse-resize border-2 border-white shadow-lg"></div>
              <div class="absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full opacity-0 group-hover:opacity-100 cursor-nesw-resize border-2 border-white shadow-lg"></div>
              <div class="absolute -bottom-1 -left-1 w-4 h-4 bg-black rounded-full opacity-0 group-hover:opacity-100 cursor-nesw-resize border-2 border-white shadow-lg"></div>
            </div>
          </div>
        </div>

        <!-- Floating Controls -->
        <div v-if="roomImage" class="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-full p-2">
          <button @click="roomImage = null" class="p-3 hover:bg-black/5 rounded-full transition-colors text-black/60" title="Сменить фото">
            <Upload class="w-5 h-5" />
          </button>
          <div class="w-px h-6 bg-black/10"></div>
          <button class="p-3 hover:bg-black/5 rounded-full transition-colors text-black/60" title="Инфо">
            <Info class="w-5 h-5" />
          </button>
        </div>
      </section>

      <!-- Right Panel: Estimate -->
      <aside class="w-80 border-l border-black/5 bg-white flex flex-col overflow-hidden">
        <div class="p-6 border-b border-black/5">
          <h2 class="text-sm font-semibold uppercase tracking-wider text-black/40">Смета проекта</h2>
        </div>
        
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="placedItems.length === 0" class="h-full flex flex-col items-center justify-center text-center opacity-30">
            <ShoppingCart class="w-12 h-12 mb-4" />
            <p class="text-sm">Добавьте товары из каталога, чтобы увидеть расчет</p>
          </div>
          
          <div v-else class="space-y-4">
            <div 
              v-for="item in placedItems" 
              :key="item.instanceId" 
              class="flex items-center gap-3 group p-2 rounded-lg hover:bg-[#F5F5F0] transition-colors cursor-pointer"
              :class="{ 'bg-[#F5F5F0] ring-1 ring-black/5': selectedItemId === item.instanceId }"
              @click="bringToFront(item.instanceId)"
            >
              <div class="w-12 h-12 rounded-lg overflow-hidden bg-white border border-black/5 flex-shrink-0 flex items-center justify-center">
                <img :src="item.image_url" class="max-w-full max-h-full object-contain" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ item.name }}</div>
                <div class="text-xs text-black/40">{{ item.price.toLocaleString('ru-RU') }} ₽</div>
              </div>
              <button @click.stop="removeItem(item.instanceId)" class="opacity-0 group-hover:opacity-100 p-1 text-black/20 hover:text-red-500 transition-all">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div class="p-6 bg-[#F5F5F0] border-t border-black/5">
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm text-black/40">Итого:</span>
            <span class="text-xl font-bold">{{ totalPrice.toLocaleString('ru-RU') }} ₽</span>
          </div>
          <button 
            @click="exportEstimate"
            class="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="placedItems.length === 0"
          >
            Оформить заказ
          </button>
        </div>
      </aside>
    </main>

    <!-- Custom Item Modal -->
    <div v-if="showCustomItemModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showCustomItemModal = false"></div>
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
        <div class="p-8">
          <h3 class="text-xl font-semibold mb-6">Добавить свой предмет</h3>
          
          <div v-if="isProcessingImage" class="flex flex-col items-center justify-center py-12">
            <div class="w-12 h-12 border-4 border-black/10 border-t-black rounded-full animate-spin mb-4"></div>
            <p class="text-sm text-black/40">Удаляем фон...</p>
          </div>

          <div v-else class="space-y-6">
            <div class="flex justify-center">
              <div class="w-48 h-48 rounded-2xl bg-[#F5F5F0] border border-black/5 flex items-center justify-center overflow-hidden relative group">
                <img :src="customItemForm.image_url" class="max-w-full max-h-full object-contain" />
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span class="text-white text-xs font-medium">Предпросмотр</span>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-black/40 mb-1.5 ml-1">Название</label>
                <input 
                  v-model="customItemForm.name"
                  type="text" 
                  placeholder="Напр. Мой любимый диван"
                  class="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-black/40 mb-1.5 ml-1">Цена (₽)</label>
                <input 
                  v-model="customItemForm.price"
                  type="number" 
                  placeholder="0"
                  class="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border border-black/5 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all"
                />
              </div>
            </div>
          </div>

          <div class="flex gap-3 mt-8">
            <button 
              @click="showCustomItemModal = false"
              class="flex-1 py-3 px-6 rounded-xl border border-black/10 font-medium hover:bg-black/5 transition-colors"
            >
              Отмена
            </button>
            <button 
              @click="confirmAddCustomItem"
              :disabled="isProcessingImage"
              class="flex-1 py-3 px-6 rounded-xl bg-black text-white font-medium hover:bg-black/80 transition-colors disabled:opacity-50"
            >
              Добавить
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.interact-target {
  touch-action: none;
  user-select: none;
}
</style>
