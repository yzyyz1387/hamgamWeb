import SparkMD5 from 'spark-md5'

export async function computePHash(file, size = 8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    img.onload = () => {
      try {
        canvas.width = size
        canvas.height = size
        ctx.drawImage(img, 0, 0, size, size)
        
        const imageData = ctx.getImageData(0, 0, size, size)
        const pixels = imageData.data
        
        const grayscale = []
        for (let i = 0; i < pixels.length; i += 4) {
          const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2])
          grayscale.push(gray)
        }
        
        const avg = grayscale.reduce((a, b) => a + b, 0) / grayscale.length
        
        let hash = ''
        for (let i = 0; i < grayscale.length; i++) {
          hash += grayscale[i] >= avg ? '1' : '0'
        }
        
        URL.revokeObjectURL(img.src)
        resolve(hash)
      } catch (error) {
        URL.revokeObjectURL(img.src)
        reject(error)
      }
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    
    img.src = URL.createObjectURL(file)
  })
}

export async function computeMD5(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const spark = new SparkMD5.ArrayBuffer()
        spark.append(reader.result)
        resolve(spark.end())
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

export function hexToBit64(hex) {
  if (!hex || hex.length !== 16) return null
  return hex
}

export function binaryToHex(binary) {
  if (!binary) return null
  const len = binary.length
  let hex = ''
  for (let i = 0; i < len; i += 4) {
    const nibble = binary.slice(i, i + 4)
    hex += parseInt(nibble, 2).toString(16)
  }
  return hex
}

export function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return -1
  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++
  }
  return distance
}
