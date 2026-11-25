/** Retrieval benchmark cases shared by the benchmark and the tests. */
/** [query as the technician or the agent says it, expected source id, machine or ''] */
export const CASES = [
  ['alarm 1014 spindle overload', 'VMC850 §7.3', 'CNC-L3-07'],
  ['spindle bearing inspection replacement', 'VMC850 §7.4', 'CNC-L3-07'],
  ['drive belt tension slipping', 'VMC850 §6.2', 'CNC-L3-07'],
  ['alarm 2031 coolant pressure', 'VMC850 §7.8', 'CNC-L3-07'],
  ['H21 hydraulic oil over temperature', 'HP200 §5.1', 'PRS-L1-02'],
  ['return line filter change press', 'HP200 §5.4', 'PRS-L1-02'],
  ['compressor high discharge temperature', 'SC37 §4.2', 'CMP-U1-01'],
  ['lockout tagout procedure', 'SOP-SAF-01', ''],
  ['Line 3 CNC pe alarm 1014 aa raha hai', 'VMC850 §7.3', ''],
  ['bearing kaise check karun, ghis ghis awaaz', 'VMC850 §7.4', 'CNC-L3-07'],
  ['belt dheela hai kya', 'VMC850 §6.2', 'CNC-L3-07'],
  ['coolant ka pressure kam hai 2031', 'VMC850 §7.8', ''],
  ['press ka tel garam ho raha hai H21', 'HP200 §5.1', ''],
  ['filter badalna hai press ka', 'HP200 §5.4', 'PRS-L1-02'],
  ['compressor bahut garam ho raha hai', 'SC37 §4.2', ''],
  ['LOTO kaise karte hain', 'SOP-SAF-01', ''],
  ['spindle noise history', 'WO-2291', 'CNC-L3-07'],
  ['press H21 pichhli baar kya kiya', 'WO-2488', 'PRS-L1-02'],
];
