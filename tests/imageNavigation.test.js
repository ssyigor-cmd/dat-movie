import { describe, it, expect } from 'vitest';
import {
  nextImage,
  prevImage,
  resetImageIndex,
  filterImagesByLanguage,
  dedupeImages,
  sortImagesByWidth,
  processImages
} from '../src/lib/imageNavigation.js';

describe('nextImage', () => {
  it('avança para o próximo índice', () => {
    expect(nextImage(0, 3)).toBe(1);
    expect(nextImage(1, 3)).toBe(2);
  });

  it('faz wrap-around circular no último índice', () => {
    expect(nextImage(2, 3)).toBe(0);
  });

  it('retorna 0 quando a lista tem 0 ou 1 item', () => {
    expect(nextImage(0, 0)).toBe(0);
    expect(nextImage(0, 1)).toBe(0);
  });
});

describe('prevImage', () => {
  it('volta para o índice anterior', () => {
    expect(prevImage(2, 3)).toBe(1);
    expect(prevImage(1, 3)).toBe(0);
  });

  it('faz wrap-around circular no primeiro índice', () => {
    expect(prevImage(0, 3)).toBe(2);
  });

  it('retorna 0 quando a lista tem 0 ou 1 item', () => {
    expect(prevImage(0, 0)).toBe(0);
    expect(prevImage(0, 1)).toBe(0);
  });
});

describe('resetImageIndex', () => {
  it('sempre retorna 0', () => {
    expect(resetImageIndex()).toBe(0);
    expect(resetImageIndex()).toBe(0);
  });
});

describe('filterImagesByLanguage', () => {
  it('mantém apenas imagens com iso_639_1 null, en ou pt', () => {
    const images = [
      { file_path: '/a.jpg', iso_639_1: null },
      { file_path: '/b.jpg', iso_639_1: 'en' },
      { file_path: '/c.jpg', iso_639_1: 'pt' },
      { file_path: '/d.jpg', iso_639_1: 'fr' },
      { file_path: '/e.jpg', iso_639_1: 'ja' }
    ];
    const result = filterImagesByLanguage(images);
    expect(result).toHaveLength(3);
    expect(result.map(i => i.file_path)).toEqual(['/a.jpg', '/b.jpg', '/c.jpg']);
  });

  it('retorna array vazio para entrada inválida', () => {
    expect(filterImagesByLanguage(null)).toEqual([]);
    expect(filterImagesByLanguage(undefined)).toEqual([]);
    expect(filterImagesByLanguage('não-array')).toEqual([]);
  });
});

describe('dedupeImages', () => {
  it('remove duplicatas por file_path usando Map', () => {
    const images = [
      { file_path: '/a.jpg', width: 100 },
      { file_path: '/b.jpg', width: 200 },
      { file_path: '/a.jpg', width: 300 }, // duplicata
      { file_path: '/c.jpg', width: 400 }
    ];
    const result = dedupeImages(images);
    expect(result).toHaveLength(3);
    // A primeira ocorrência é mantida
    expect(result[0].width).toBe(100);
  });

  it('ignora itens sem file_path', () => {
    const images = [
      { file_path: '/a.jpg' },
      { width: 200 }, // sem file_path
      null,
      undefined
    ];
    const result = dedupeImages(images);
    expect(result).toHaveLength(1);
  });
});

describe('sortImagesByWidth', () => {
  it('ordena por largura decrescente (maiores primeiro)', () => {
    const images = [
      { file_path: '/a.jpg', width: 100 },
      { file_path: '/b.jpg', width: 500 },
      { file_path: '/c.jpg', width: 300 }
    ];
    const result = sortImagesByWidth(images);
    expect(result.map(i => i.width)).toEqual([500, 300, 100]);
  });

  it('não modifica o array original', () => {
    const images = [
      { file_path: '/a.jpg', width: 100 },
      { file_path: '/b.jpg', width: 500 }
    ];
    sortImagesByWidth(images);
    expect(images[0].width).toBe(100);
  });
});

describe('processImages (integração)', () => {
  it('combina posters e backdrops, filtra idioma, deduplica e ordena', () => {
    const imagesData = {
      posters: [
        { file_path: '/poster1.jpg', iso_639_1: 'en', width: 500 },
        { file_path: '/poster2.jpg', iso_639_1: 'fr', width: 800 }, // filtrado (fr)
        { file_path: '/poster3.jpg', iso_639_1: null, width: 300 }
      ],
      backdrops: [
        { file_path: '/backdrop1.jpg', iso_639_1: 'en', width: 1920 },
        { file_path: '/poster1.jpg', iso_639_1: 'en', width: 500 }, // duplicata
        { file_path: '/backdrop2.jpg', iso_639_1: 'pt', width: 1280 }
      ]
    };

    const result = processImages(imagesData);

    // 4 únicos: poster1, poster3, backdrop1, backdrop2
    expect(result).toHaveLength(4);
    // Ordenado por largura decrescente
    expect(result[0].file_path).toBe('/backdrop1.jpg');
    expect(result[1].file_path).toBe('/backdrop2.jpg');
    expect(result[2].file_path).toBe('/poster1.jpg');
    expect(result[3].file_path).toBe('/poster3.jpg');
  });

  it('retorna array vazio quando não há imagens válidas', () => {
    expect(processImages(null)).toEqual([]);
    expect(processImages({})).toEqual([]);
    expect(processImages({ posters: [], backdrops: [] })).toEqual([]);
  });
});