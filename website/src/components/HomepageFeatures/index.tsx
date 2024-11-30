import Link from '@docusaurus/Link'
import useBaseUrl from '@docusaurus/useBaseUrl'
import Heading from '@theme/Heading'
import ThemedImage from '@theme/ThemedImage'

import styles from './styles.module.css'

type FeatureItem = {
  img: string
  title: string
  description: string
  link: string
}

function Feature({ img, title, description, link }: FeatureItem) {
  return (
    <div className="col col--4">
      <div className="text--center">
        <ThemedImage
          className={styles.featureSvg}
          sources={{
            light: useBaseUrl(`/img/${img}-light.svg`),
            dark: useBaseUrl(`/img/${img}-dark.svg`),
          }}
        />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h2">{title}</Heading>
        <p>{description}</p>
        <Link
          className="button button--primary"
          to={link}
          data-umami-event="Home CTA"
          data-umami-event-cta={title}>
          Learn more
        </Link>
      </div>
    </div>
  )
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <Feature
            img="easy"
            title="Easy to use"
            link="/docs/overview#server-defined-user-interface"
            description="With server-defined Tiles, developers can easily create and update components to display in multiple clients without having to update the clients themselves"
          />
          <Feature
            img="universal"
            title="Universal access"
            link="/docs/overview#universally-accessible"
            description="Uniquely identified using URIs, Tiles render on the Web, native UIs or even fallback images as needed"
          />
          <Feature
            img="auth"
            title="Authenticated interactions"
            link="/docs/overview#authenticated-interactions"
            description="User actions are authenticated using cryptographic signatures, enabling trusted interactions from Tiles without the need for account creation"
          />
        </div>
      </div>
    </section>
  )
}
