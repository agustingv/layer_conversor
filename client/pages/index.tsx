import Head from "next/head";
import Link from "next/link";

const HomePage = () => (
  <>
    <Head><title>Layer Provider</title></Head>
    <div className="home-page">
      <div className="home-hero">
        <h1 className="home-title">Layer Provider</h1>
        <p className="home-subtitle">
          Manage and convert geospatial files into GeoJSON layers, ready to use in your maps.
        </p>
      </div>

      <div className="home-cards">
        <div className="home-card">
          <div className="home-card-icon">📁</div>
          <h2 className="home-card-title">Projects</h2>
          <p className="home-card-desc">
            Organise your layers into projects. Each project groups related geographic datasets for easier management.
          </p>
          <div className="home-card-actions">
            <Link href="/projects" className="btn-edit">View projects</Link>
            <Link href="/projects/create" className="home-link">+ New project</Link>
          </div>
        </div>

        <div className="home-card">
          <div className="home-card-icon">🗺️</div>
          <h2 className="home-card-title">Layers</h2>
          <p className="home-card-desc">
            Upload Shapefiles, GeoPackages, KML, and other formats. Files are automatically converted to GeoJSON and previewed on a map.
          </p>
          <div className="home-card-actions">
            <Link href="/layers" className="btn-edit">View layers</Link>
            <Link href="/layers/create" className="home-link">+ New layer</Link>
          </div>
        </div>
      </div>

      <div className="home-how">
        <h3 className="home-how-title">How conversion works</h3>
        <ol className="home-how-steps">
          <li className="home-how-step">
            <span className="home-how-num">1</span>
            <div>
              <strong>Create a layer and upload a file</strong>
              <p>Give the layer a name, pick a project, and attach a geo file (Shapefile ZIP, GeoPackage, KML, GPX, GML, or GeoJSON).</p>
            </div>
          </li>
          <li className="home-how-step">
            <span className="home-how-num">2</span>
            <div>
              <strong>Analyse the file</strong>
              <p>On the edit page, click <em>Convert to GeoJSON</em>. The server inspects the file and reports how many layers it contains and their geometry types.</p>
            </div>
          </li>
          <li className="home-how-step">
            <span className="home-how-num">3</span>
            <div>
              <strong>Choose how to import multi-layer files</strong>
              <p>If the file has more than one layer you can keep them as separate layer records, or merge layers that share the same geometry type into a single GeoJSON file.</p>
            </div>
          </li>
          <li className="home-how-step">
            <span className="home-how-num">4</span>
            <div>
              <strong>Conversion runs in the background</strong>
              <p>The job is placed in a queue and processed by a background worker. The layer list shows a <em>Not converted</em> badge while it is pending and updates once the GeoJSON is ready.</p>
            </div>
          </li>
          <li className="home-how-step">
            <span className="home-how-num">5</span>
            <div>
              <strong>Use the GeoJSON output</strong>
              <p>Once converted, the layer page shows a map preview and the GeoJSON file is available for download or direct use in your application.</p>
            </div>
          </li>
        </ol>
      </div>

      <div className="home-formats">
        <h3 className="home-formats-title">Supported formats</h3>
        <div className="home-format-list">
          {["Shapefile (.zip)", "GeoPackage (.gpkg)", "KML / KMZ (.kml, .kmz)", "GeoJSON (.geojson, .json)", "GPX (.gpx)", "GML (.gml)"].map((f) => (
            <span key={f} className="home-format-tag">{f}</span>
          ))}
        </div>
      </div>
    </div>
  </>
);

export default HomePage;
