import intersection from 'lodash/intersection';
import Genotypes from '@/snappy/Genotypes';
import Genosets from '@/snappy/Genosets';
import File from '@/snappy/File';

async function process(payload) {
  const options = payload.options;
  const file = new File('', payload.snps);
  const genosets = await Genosets.getSupportedGenosets();
  const snps = await Genotypes.getSupportedSnps();
  const promises = [];

  const reflect = p => p
    .then(data => ({
      status: 'resolved',
      data,
    }))
    .catch(error => ({
      status: 'rejected',
      error,
    }));

  const commonSnps = intersection(
    Object.keys(file.snps),
    snps,
  );
  for (const snp of commonSnps) {
    const genotype = file.normalizedSnps[snp].genotype;
    if (genotype !== '??') {
      promises.push(reflect(Genotypes.get(snp, genotype)));
    }
  }

  if (options.enableGenosets) {
    for (const genoset of genosets) {
      promises.push(reflect(new Promise((r, rj) => {
        Genosets.get(genoset).then((gs) => {
          if (gs.match(file)) {
            return r(gs);
          }
          return rj();
        });
      })));
    }
  }

  const reflected = await Promise.all(promises);
  const results = [];
  for (const r of reflected) {
    if (r.status === 'resolved') {
      results.push(Object.assign({}, r.data));
    }
  }

  return postMessage({
    state: 'done',
    results: JSON.stringify(results),
  });
}

self.addEventListener('message', (event) => {
  process(event.data);
});
